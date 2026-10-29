using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;

namespace Thesamenot.Api.Middleware;

public sealed class StoreAntiforgeryMiddleware(RequestDelegate next, IConfiguration configuration)
{
    public async Task InvokeAsync(HttpContext context, IAntiforgery antiforgery)
    {
        if (configuration.GetValue<bool>("Auth:Enabled") && context.Request.Method is not ("GET" or "HEAD") &&
            context.Request.Path != "/api/payments/webhook")
        {
            // The browser has separate customer/admin identities. Bind the CSRF token to its
            // protected antiforgery cookie and verify Origin, without coupling it to either identity.
            var principal = context.User;
            try
            {
                context.User = new ClaimsPrincipal(new ClaimsIdentity());
                await antiforgery.ValidateRequestAsync(context);
            }
            catch (AntiforgeryValidationException) { throw new StoreException(403, "Invalid request verification."); }
            finally { context.User = principal; }
        }
        await next(context);
    }
}
