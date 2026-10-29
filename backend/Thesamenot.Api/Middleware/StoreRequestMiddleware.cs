namespace Thesamenot.Api.Middleware;

public sealed class StoreRequestMiddleware(RequestDelegate next, ILogger<StoreRequestMiddleware> logger, IConfiguration configuration)
{
    public async Task InvokeAsync(HttpContext context, StoreDatabase database, IWebHostEnvironment environment)
    {
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers.CacheControl = "no-store";

        if (RequiresStoreHeader(context.Request) && context.Request.Headers["X-Store-Request"] != "1")
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { message = "Invalid request origin." });
            return;
        }

        try
        {
            if (RequiresStoreHeader(context.Request))
            {
                var origin = context.Request.Headers.Origin.ToString();
                var expected = new Uri(configuration["Store:PublicUrl"]!).GetLeftPart(UriPartial.Authority);
                var allowed = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
                if (origin.Length != 0 && !string.Equals(origin, expected, StringComparison.OrdinalIgnoreCase) && !allowed.Contains(origin, StringComparer.OrdinalIgnoreCase))
                    throw new StoreException(403, "Invalid request origin.");
            }
            var maxBody = context.Request.Path.StartsWithSegments("/api/admin/catalog") && context.Request.Path.Value!.EndsWith("/images")
                ? 6291456L : context.Request.Path.StartsWithSegments("/api/auth") || context.Request.Path == "/api/admin/login" ? 16384L : 1048576L;
            var bodyFeature = context.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
            if (bodyFeature is { IsReadOnly: false }) bodyFeature.MaxRequestBodySize = maxBody;
            if (context.Request.ContentLength > maxBody) throw new StoreException(413, "Request is too large.");
            if (configuration.GetValue<bool>("Auth:Enabled") && RequiresStoreHeader(context.Request) &&
                (context.Request.Path.StartsWithSegments("/api/auth") || context.Request.Path == "/api/admin/login"))
            {
                var login = context.Request.Path.Value is "/api/auth/login" or "/api/admin/login" or "/api/auth/admin/mfa/verify";
                var limit = environment.IsDevelopment() ? configuration.GetValue(login ? "Auth:LoginPermitLimit" : "Auth:AccountPermitLimit", login ? 5 : 20) : login ? 5 : 20;
                var key = "ip-minute:" + limit + ":" + (login ? "login" : "account") + ":" + DateTime.UtcNow.ToString("yyyyMMddHHmm") + ":" + context.Connection.RemoteIpAddress;
                if (!await database.TakeAuthTargetLimit(key, limit)) throw new StoreException(429, "Too many requests. Please retry shortly.", 60);
            }
            await next(context);
        }
        catch (StoreException exception)
        {
            context.Response.StatusCode = exception.Status;
            if (exception.Status == 429) context.Response.Headers.RetryAfter = (exception.RetryAfterSeconds ?? 3600).ToString(System.Globalization.CultureInfo.InvariantCulture);
            await context.Response.WriteAsJsonAsync(new { message = exception.Message });
        }
        catch (BadHttpRequestException exception)
        {
            context.Response.StatusCode = exception.StatusCode;
            await context.Response.WriteAsJsonAsync(new { message = "Invalid request." });
        }
        catch (MySqlConnector.MySqlException exception) when (exception.Number == 1062)
        {
            context.Response.StatusCode = 409;
            await context.Response.WriteAsJsonAsync(new { message = "This slug or SKU is already in use. Refresh and retry." });
        }
        catch (Stripe.StripeException exception)
        {
            logger.LogWarning("Stripe request failed ({Status}).", exception.HttpStatusCode);
            context.Response.StatusCode = StatusCodes.Status502BadGateway;
            await context.Response.WriteAsJsonAsync(new
            {
                message = "The payment service is unavailable. Please retry this checkout."
            });
        }
        catch (Exception exception)
        {
            logger.LogError("Store request failed ({Type}/{Code}), trace {Trace}.", exception.GetType().Name,
                exception is MySqlConnector.MySqlException sql ? sql.Number : 0, context.TraceIdentifier);
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(new
            {
                message = "The store is temporarily unavailable. Please try again shortly."
            });
        }
    }

    private static bool RequiresStoreHeader(HttpRequest request) =>
        request.Method is not ("GET" or "HEAD") && request.Path != "/api/payments/webhook";
}
