using System.Net;
using System.Threading.RateLimiting;
using Dapper;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
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
        ValidateStoreOptions(options, environment, configuration);

        services.AddSingleton(options);
        services.AddSingleton<StoreDatabase>();
        services.AddSingleton<Payments>();
        services.AddSingleton<AdminAuthenticationService>();
        services.AddHostedService<ReservationWorker>();

        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(cookie =>
            {
                cookie.Cookie.Name = "tsn_admin";
                cookie.Cookie.HttpOnly = true;
                cookie.Cookie.SameSite = SameSiteMode.Strict;
                cookie.Cookie.SecurePolicy = environment.IsDevelopment()
                    ? CookieSecurePolicy.SameAsRequest
                    : CookieSecurePolicy.Always;
                cookie.ExpireTimeSpan = TimeSpan.FromHours(2);
                cookie.SlidingExpiration = false;
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
            });
        services.AddAuthorization();

        services.Configure<ForwardedHeadersOptions>(forwarded =>
        {
            forwarded.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            forwarded.ForwardLimit = 1;

            var knownAddresses = configuration.GetSection("Proxy:KnownAddresses").Get<string[]>() ?? [];
            foreach (var address in knownAddresses)
            {
                forwarded.KnownProxies.Add(IPAddress.Parse(address));
            }
        });

        services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiter.AddPolicy("public", context => CreateIpLimiter(context, 60));
            limiter.AddPolicy("login", context => CreateIpLimiter(context, 5));
        });

        return services;
    }

    private static void ValidateStoreOptions(StoreOptions options, IWebHostEnvironment environment, IConfiguration configuration)
    {
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

            if (string.IsNullOrWhiteSpace(configuration["Admin:Email"]) ||
                string.IsNullOrWhiteSpace(configuration["Admin:PasswordHash"]))
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
