using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Thesamenot.Api.Validation;

namespace Thesamenot.Api.Services;

public sealed class OrderAccessService(StoreDatabase db, EmailService email, IDataProtectionProvider protection, IWebHostEnvironment environment)
{
    private readonly ITimeLimitedDataProtector protector = protection.CreateProtector("thesamenot.guest-order-access.v1").ToTimeLimitedDataProtector();
    private string CookieName => environment.IsDevelopment() ? "tsn_order_access" : "__Host-tsn_order_access";
    public async Task RequestLink(OrderLinkRequest request, CancellationToken ct)
    {
        request = request with { Email = AuthValidation.Email(request.Email).ToLowerInvariant() };
        AccountValidation.Text(request.OrderNumber, 40);
        if (request.Purpose is not ("access" or "claim")) throw new StoreException(400, "Invalid link purpose.");
        if (!await db.TakeAuthTargetLimit("order-link:" + request.Email.ToUpperInvariant()))
            throw new StoreException(429, "Too many link requests. Please retry later.");
        var token = await db.IssueOrderAccess(request);
        if (token is not null) await email.FlushDevelopmentKey("email:guest:" + StoreDatabase.SecretHash(token), ct);
    }
    public async Task Exchange(string token, HttpContext context)
    {
        var grant = await db.CompleteOrderAccess(AuthValidation.Token(token), "access", null);
        context.Response.Cookies.Append(CookieName, protector.Protect(grant.Id + ":" + grant.OrderId, TimeSpan.FromMinutes(15)),
            new CookieOptions
            {
                HttpOnly = true,
                Path = "/",
                IsEssential = true,
                SameSite = SameSiteMode.Strict,
                Secure = !environment.IsDevelopment() || context.Request.IsHttps,
                MaxAge = TimeSpan.FromMinutes(15)
            });
    }
    public async Task<Order> Current(HttpContext context)
    {
        var parts = ReadGrant(context);
        return await db.GuestOrder(parts[0], parts[1]);
    }
    public string GrantId(HttpContext context) => ReadGrant(context)[0];
    private string[] ReadGrant(HttpContext context)
    {
        var value = context.Request.Cookies[CookieName];
        if (value is not { Length: < 1024 }) throw new StoreException(401, "Request a new order access link.");
        string[] parts;
        try { parts = protector.Unprotect(value, out _).Split(':'); }
        catch (Exception error) when (error is CryptographicException or FormatException)
        { throw new StoreException(401, "Order access expired. Request a new link."); }
        if (parts.Length != 2) throw new StoreException(401, "Request a new order access link.");
        return parts;
    }
}
