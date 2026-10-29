using System.Net;
using System.Threading.RateLimiting;
using Dapper;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Thesamenot.Api.Security;

namespace Thesamenot.Api.Hosting;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddStoreBackend(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        var options = configuration.GetSection("Store").Get<StoreOptions>() ?? new();
        Services.TaxCalculator.Read(configuration);
        Services.LegalPolicies.All(configuration);
        ValidateStoreOptions(options, environment, configuration);

        services.AddSingleton(options);
        var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        if (origins.Any(origin => !Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.GetLeftPart(UriPartial.Authority) != origin ||
            (!environment.IsDevelopment() && uri.Scheme != "https")))
            throw new InvalidOperationException("CORS requires exact trusted origins, with HTTPS outside Development.");
        services.AddCors(cors => cors.AddDefaultPolicy(policy =>
        {
            if (origins.Length > 0) policy.WithOrigins(origins).WithMethods("GET", "POST", "PUT", "DELETE", "HEAD").WithHeaders("Content-Type", "X-Store-Request", "X-CSRF-Token").AllowCredentials();
        }));
        services.AddSingleton<StoreDatabase>();
        services.AddSingleton<Payments>();
        services.AddSingleton<CheckoutIdentity>();
        services.AddSingleton<Thesamenot.Api.Services.ProductMediaService>();
        services.AddSingleton<Thesamenot.Api.Services.StoreJobRunner>();
        services.AddSingleton<AdminAuthenticationService>();
        if (configuration.GetValue("Workers:Enabled", true))
        {
            services.AddHostedService<ReservationWorker>();
            services.AddHostedService<Thesamenot.Api.Services.OperationsWorker>();
            services.AddHostedService<Thesamenot.Api.Services.RefundWorker>();
            services.AddHostedService<Thesamenot.Api.Services.ReconciliationWorker>();
        }
        else if (!environment.IsDevelopment()) throw new InvalidOperationException("Workers may only be disabled for Development maintenance checks.");
        var accounts = configuration.GetValue<bool>("Auth:Enabled");
        services.AddStoreIdentity(configuration);
        if (accounts) services.ConfigureStoreKeyRing(configuration, environment);
        var authentication = services.AddAuthentication(accounts
            ? AuthorizationPolicies.CustomerScheme : AuthorizationPolicies.LegacyScheme);
        void Cookie(CookieAuthenticationOptions cookie, string name, int hours, SameSiteMode sameSite, bool validate)
        {
            cookie.Cookie.Name = environment.IsDevelopment() ? name : "__Host-" + name;
            cookie.Cookie.Path = "/";
            cookie.Cookie.HttpOnly = true;
            cookie.Cookie.SameSite = sameSite;
            cookie.Cookie.SecurePolicy = environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
            cookie.ExpireTimeSpan = TimeSpan.FromHours(hours);
            cookie.SlidingExpiration = false;
            if (validate) cookie.EventsType = typeof(SessionValidation);
            else
            {
                cookie.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                cookie.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
            }
        }
        authentication.AddCookie(AuthorizationPolicies.CustomerScheme, c => Cookie(c, "tsn_customer", 24, SameSiteMode.Lax, true));
        authentication.AddCookie(AuthorizationPolicies.AdminScheme, c => Cookie(c, "tsn_admin", 2, SameSiteMode.Strict, true));
        if (!accounts) authentication.AddCookie(AuthorizationPolicies.LegacyScheme, c => Cookie(c, "tsn_demo_admin", 2, SameSiteMode.Strict, false));
        services.AddAuthorization(authorization =>
        {
            authorization.AddPolicy(AuthorizationPolicies.Customer, policy => policy
                .AddAuthenticationSchemes(AuthorizationPolicies.CustomerScheme).RequireAuthenticatedUser().RequireRole("Customer"));
            authorization.AddPolicy(AuthorizationPolicies.Admin, policy => policy
                .AddAuthenticationSchemes(accounts ? AuthorizationPolicies.AdminScheme : AuthorizationPolicies.LegacyScheme)
                .RequireAuthenticatedUser().RequireRole("Admin").RequireClaim("amr", accounts ? "mfa" : "demo"));
        });
        services.AddAntiforgery(options =>
        {
            options.HeaderName = "X-CSRF-Token";
            options.Cookie.Name = environment.IsDevelopment() ? "tsn_csrf" : "__Host-tsn_csrf";
            options.Cookie.Path = "/";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        });

        services.Configure<ForwardedHeadersOptions>(forwarded =>
        {
            forwarded.ForwardLimit = 1;
            forwarded.KnownProxies.Clear();
            forwarded.KnownIPNetworks.Clear();
            var knownAddresses = configuration.GetSection("Proxy:KnownAddresses").Get<string[]>() ?? [];
            forwarded.ForwardedHeaders = knownAddresses.Length == 0 ? ForwardedHeaders.None
                : ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            foreach (var address in knownAddresses)
            {
                forwarded.KnownProxies.Add(IPAddress.Parse(address));
            }
        });

        services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiter.OnRejected = async (context, ct) =>
            {
                context.HttpContext.Response.Headers.RetryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry)
                    ? Math.Ceiling(retry.TotalSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture) : "60";
                await context.HttpContext.Response.WriteAsJsonAsync(new { message = "Too many requests. Please retry later." }, ct);
            };
            limiter.AddPolicy("public", context => CreateIpLimiter(context, environment.IsDevelopment() ? configuration.GetValue("Auth:PublicPermitLimit", 60) : 60));
            limiter.AddPolicy("catalog", context => CreateIpLimiter(context, 300));
            limiter.AddPolicy("media", context => CreateIpLimiter(context, 600));
            limiter.AddPolicy("login", context => CreateIpLimiter(context, environment.IsDevelopment()
                ? configuration.GetValue("Auth:LoginPermitLimit", 5) : 5));
            limiter.AddPolicy("account", context => CreateIpLimiter(context, environment.IsDevelopment()
                ? configuration.GetValue("Auth:AccountPermitLimit", 20) : 20));
        });

        return services;
    }

    private static void ValidateStoreOptions(StoreOptions options, IWebHostEnvironment environment, IConfiguration configuration)
    {
        if (!environment.IsProduction() && new[] { "sk_live_", "rk_live_" }.Any(prefix => configuration["Stripe:SecretKey"]?.StartsWith(prefix, StringComparison.Ordinal) == true))
            throw new InvalidOperationException("Live Stripe credentials require the Production merchant release checks.");
        if (configuration.GetValue<bool>("Auth:Enabled"))
        {
            var smtp = configuration["Email:Mode"] == "Smtp" &&
                !string.IsNullOrWhiteSpace(configuration["Email:Host"]) && !string.IsNullOrWhiteSpace(configuration["Email:FromAddress"]);
            var localMail = environment.IsDevelopment() && configuration["Email:Mode"] == "DevelopmentFile" &&
                !string.IsNullOrWhiteSpace(configuration["Email:Directory"]);
            if (!smtp && !localMail) throw new InvalidOperationException("Accounts require SMTP or an explicit Development-only mail directory.");
        }
        if (!environment.IsDevelopment() && !environment.IsStorePreview())
        {
            if (!configuration.GetValue<bool>("Auth:Enabled") || configuration.GetValue<bool>("Database:Initialize"))
                throw new InvalidOperationException("Production requires database identity and separately applied migrations.");
            if (configuration["Email:Mode"] != "Smtp" || string.IsNullOrWhiteSpace(configuration["Email:Host"]) ||
                string.IsNullOrWhiteSpace(configuration["Email:FromAddress"]) ||
                string.IsNullOrWhiteSpace(configuration["Auth:CompromisedPasswordHashesPath"]) ||
                !File.Exists(configuration["Auth:CompromisedPasswordHashesPath"]))
                throw new InvalidOperationException("Production requires an email provider and a compromised-password hash list.");
            if (!Uri.TryCreate(options.PublicUrl, UriKind.Absolute, out var productionUrl) || productionUrl.Scheme != "https")
                throw new InvalidOperationException("Production requires an HTTPS public URL.");
        }
        if (!environment.AllowsPaymentSimulation() && options.PaymentMode == "Simulation")
        {
            throw new InvalidOperationException("Simulation payments are only allowed in Development or Preview.");
        }

        if (environment.IsStorePreview())
        {
            if (options.PaymentMode != "Simulation")
            {
                throw new InvalidOperationException("Preview requires Simulation payments.");
            }

            if (!Uri.TryCreate(options.PublicUrl, UriKind.Absolute, out var publicUrl) ||
                publicUrl.Scheme != Uri.UriSchemeHttps)
            {
                throw new InvalidOperationException("Preview requires an HTTPS public URL.");
            }

            if (!configuration.GetValue<bool>("Auth:Enabled") && (string.IsNullOrWhiteSpace(configuration["Admin:Email"]) ||
                string.IsNullOrWhiteSpace(configuration["Admin:PasswordHash"])))
            {
                throw new InvalidOperationException("Preview requires configured admin credentials.");
            }

            if (!string.IsNullOrWhiteSpace(configuration["Stripe:SecretKey"]) ||
                !string.IsNullOrWhiteSpace(configuration["Stripe:WebhookSecret"]))
            {
                throw new InvalidOperationException("Preview must not contain Stripe credentials.");
            }
        }

        if (options.ShippingCents < 0 || options.FreeShippingThresholdCents < 0)
        {
            throw new InvalidOperationException("Shipping configuration is invalid.");
        }
    }

    private static RateLimitPartition<string> CreateIpLimiter(HttpContext context, int permitLimit)
    {
        var clientAddress = context.Connection.RemoteIpAddress?.ToString() ?? "local";
        return RateLimitPartition.GetFixedWindowLimiter(clientAddress, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = permitLimit,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });
    }
}
