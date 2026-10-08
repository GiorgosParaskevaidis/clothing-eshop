using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Dapper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Thesamenot.Api;

var builder=WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json",optional:true).AddEnvironmentVariables();
DefaultTypeMap.MatchNamesWithUnderscores=true;
var options=builder.Configuration.GetSection("Store").Get<Thesamenot.Api.StoreOptions>()??new();
if(!builder.Environment.IsDevelopment() && options.PaymentMode=="Simulation") throw new InvalidOperationException("Simulation payments are only allowed in Development.");
if(options.ShippingCents<0 || options.FreeShippingThresholdCents<0) throw new InvalidOperationException("Shipping configuration is invalid.");
builder.Services.AddSingleton(options);
builder.Services.AddSingleton<StoreDatabase>();
builder.Services.AddSingleton<Payments>();
builder.Services.AddHostedService<ReservationWorker>();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o=>{
    o.Cookie.Name="tsn_admin";o.Cookie.HttpOnly=true;o.Cookie.SameSite=SameSiteMode.Strict;
    o.Cookie.SecurePolicy=builder.Environment.IsDevelopment()?CookieSecurePolicy.SameAsRequest:CookieSecurePolicy.Always;
    o.ExpireTimeSpan=TimeSpan.FromHours(2);o.SlidingExpiration=false;
    o.Events.OnRedirectToLogin=ctx=>{ctx.Response.StatusCode=401;return Task.CompletedTask;};
    o.Events.OnRedirectToAccessDenied=ctx=>{ctx.Response.StatusCode=403;return Task.CompletedTask;};
});
builder.Services.AddAuthorization();
builder.Services.Configure<ForwardedHeadersOptions>(o=>{
    o.ForwardedHeaders=ForwardedHeaders.XForwardedFor|ForwardedHeaders.XForwardedProto;
    o.ForwardLimit=1;
    foreach(var address in builder.Configuration.GetSection("Proxy:KnownAddresses").Get<string[]>()??[]) o.KnownProxies.Add(System.Net.IPAddress.Parse(address));
});
builder.Services.AddRateLimiter(o=>{
    o.RejectionStatusCode=429;
    o.AddPolicy("public",ctx=>RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString()??"local",_=>new FixedWindowRateLimiterOptions {PermitLimit=60,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));
    o.AddPolicy("login",ctx=>RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString()??"local",_=>new FixedWindowRateLimiterOptions {PermitLimit=5,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));
});
var app=builder.Build();
app.UseForwardedHeaders();
app.Use(async(ctx,next)=>{
    ctx.Response.Headers["X-Content-Type-Options"]="nosniff";
    ctx.Response.Headers.CacheControl="no-store";
    if(ctx.Request.Method is not ("GET" or "HEAD") && ctx.Request.Path!="/api/payments/webhook" && ctx.Request.Headers["X-Store-Request"]!="1") {ctx.Response.StatusCode=403;await ctx.Response.WriteAsJsonAsync(new {message="Invalid request origin."});return;}
    try {await next();}
    catch(StoreException e){ctx.Response.StatusCode=e.Status;await ctx.Response.WriteAsJsonAsync(new {message=e.Message});}
    catch(Stripe.StripeException e){app.Logger.LogWarning(e,"Stripe request failed.");ctx.Response.StatusCode=502;await ctx.Response.WriteAsJsonAsync(new {message="The payment service is unavailable. Please retry this checkout."});}
    catch(Exception e){app.Logger.LogError(e,"Store request failed.");ctx.Response.StatusCode=503;await ctx.Response.WriteAsJsonAsync(new {message="The store is temporarily unavailable. Please try again shortly."});}
});
app.UseRateLimiter();app.UseAuthentication();app.UseAuthorization();
app.MapGet("/api/health",async(StoreDatabase db)=>{await using var connection=await db.Open();return Results.Ok(new {status="healthy",database=await connection.ExecuteScalarAsync<string>("SELECT VERSION()")});});
app.MapGet("/api/store",(Payments payments)=>new {brand="thesamenot",options.DropOpensAt,options.SalesEnabled,options.ShippingCents,options.FreeShippingThresholdCents,options.InstagramUrl,options.ContactEmail,checkoutAvailable=payments.Ready,simulation=payments.IsSimulation});
app.MapGet("/api/products",(StoreDatabase db)=>db.Products());
app.MapPost("/api/newsletter",async(NewsletterRequest request,StoreDatabase db)=>{
    if(!ValidEmail(request.Email)||!request.Consent) throw new StoreException(400,"Enter a valid email and agree to receive drop updates.");
    await db.Subscribe(request);return Results.Ok(new {message="You are on the list."});
}).RequireRateLimiting("public");
app.MapPost("/api/newsletter/unsubscribe",async(UnsubscribeRequest request,StoreDatabase db)=>{await db.Unsubscribe(request.Token);return Results.Ok(new {message="You have been unsubscribed."});}).RequireRateLimiting("public");
app.MapPost("/api/checkout",async(CheckoutRequest request,Payments payments)=>{
    if(!Guid.TryParse(request.RequestKey,out _) || !ValidEmail(request.Email) || !request.AcceptTerms || request.Country!="GR" || !Text(request.Name,120) || !Text(request.Address,250) || !Text(request.City,120) || !Text(request.PostalCode,24) || request.Items is null || request.Items.Count is <1 or >8 || request.Items.Any(x=>!Text(x.VariantId,60)||x.Quantity is <1 or >10) || request.Items.Select(x=>x.VariantId).Distinct().Count()!=request.Items.Count) throw new StoreException(400,"Check your contact details, shipping address, terms and basket quantities.");
    return Results.Ok(await payments.Checkout(request));
}).RequireRateLimiting("public");
app.MapGet("/api/orders/{token}",async(string token,StoreDatabase db)=>{
    var order=await db.PublicOrder(token)??throw new StoreException(404,"Order not found.");
    return Results.Ok(new {number=order.Id[..8].ToUpperInvariant(),order.Status,order.PaymentMode,order.TotalCents,order.ShippingCents,order.Items});
}).RequireRateLimiting("public");
app.MapPost("/api/payments/webhook",async(HttpRequest request,Payments payments)=>{
    if(request.ContentLength>1_000_000) return Results.BadRequest();
    using var reader=new StreamReader(request.Body);var json=await reader.ReadToEndAsync();
    try {await payments.Webhook(json,request.Headers["Stripe-Signature"].ToString());}
    catch(Stripe.StripeException){return Results.BadRequest(new {message="Invalid webhook signature."});}
    return Results.Ok();
});
if(app.Environment.IsDevelopment()) app.MapPost("/api/payments/simulation",async(UnsubscribeRequest request,Payments payments)=>{await payments.CompleteSimulation(request.Token);return Results.Ok();}).RequireRateLimiting("public");
app.MapPost("/api/admin/login",async(LoginRequest request,HttpContext ctx,IConfiguration config)=>{
    var email=config["Admin:Email"];var hash=config["Admin:PasswordHash"];
    if(string.IsNullOrWhiteSpace(hash)||request.Email!=email||new PasswordHasher<string>().VerifyHashedPassword(email??"",hash,request.Password)==PasswordVerificationResult.Failed) throw new StoreException(401,"Invalid email or password.");
    await ctx.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name,email!)],CookieAuthenticationDefaults.AuthenticationScheme)));
    return Results.Ok(new {email});
}).RequireRateLimiting("login");
var admin=app.MapGroup("/api/admin").RequireAuthorization();
admin.MapGet("/session",(HttpContext ctx)=>new {email=ctx.User.Identity?.Name});
admin.MapPost("/logout",async(HttpContext ctx)=>{await ctx.SignOutAsync();return Results.Ok();});
admin.MapGet("/products",(StoreDatabase db)=>db.Products(true));
admin.MapPut("/products/{id}",async(string id,ProductUpdate request,StoreDatabase db)=>{
    if(!Text(request.Name,120)||!Text(request.Description,1000)||request.PriceCents is <1 or >1_000_000) throw new StoreException(400,"Enter a name, description and valid price.");
    await db.UpdateProduct(id,request);return Results.NoContent();
});
admin.MapPut("/stock/{id}",async(string id,StockUpdate request,StoreDatabase db)=>{
    if(request.Available is <0 or >100000 || request.Version<0) throw new StoreException(400,"Invalid stock quantity.");
    await db.UpdateStock(id,request);return Results.NoContent();
});
admin.MapGet("/orders",(StoreDatabase db)=>db.Orders());
admin.MapPost("/orders/{id}/fulfill",async(string id,StoreDatabase db)=>{
    await using var connection=await db.Open();
    if(await connection.ExecuteAsync("UPDATE orders SET status='fulfilled' WHERE id=@id AND status='paid'",new {id})!=1) throw new StoreException(409,"Only paid orders can be marked shipped.");
    return Results.NoContent();
});
admin.MapGet("/subscribers",(StoreDatabase db)=>db.Subscribers());
if(builder.Configuration.GetValue<bool>("Database:Initialize")) await app.Services.GetRequiredService<StoreDatabase>().Initialize(app.Environment.ContentRootPath);
app.Run();
static bool Text(string? value,int max)=>!string.IsNullOrWhiteSpace(value)&&value.Trim().Length<=max;
static bool ValidEmail(string? value)=>value is {Length:<=254} && new EmailAddressAttribute().IsValid(value);
public record UnsubscribeRequest(string Token);
