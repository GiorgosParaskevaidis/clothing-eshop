namespace Thesamenot.Api.Middleware;

public sealed class StoreRequestMiddleware(RequestDelegate next, ILogger<StoreRequestMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
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
            await next(context);
        }
        catch (StoreException exception)
        {
            context.Response.StatusCode = exception.Status;
            await context.Response.WriteAsJsonAsync(new { message = exception.Message });
        }
        catch (Stripe.StripeException exception)
        {
            logger.LogWarning(exception, "Stripe request failed.");
            context.Response.StatusCode = StatusCodes.Status502BadGateway;
            await context.Response.WriteAsJsonAsync(new
            {
                message = "The payment service is unavailable. Please retry this checkout."
            });
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Store request failed.");
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
