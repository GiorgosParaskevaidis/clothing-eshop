using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace Thesamenot.Api.Security;

public sealed class SessionValidation(StoreDatabase database) : CookieAuthenticationEvents
{
    public override async Task ValidatePrincipal(CookieValidatePrincipalContext context)
    {
        var p = context.Principal!;
        var user = p.FindFirstValue(ClaimTypes.NameIdentifier);
        var session = p.FindFirstValue("sid");
        var stamp = p.FindFirstValue("security_stamp");
        var scope = p.FindFirstValue("store_scope");
        var amr = p.FindFirstValue("amr");
        if (user is null || session is null || stamp is null || scope is null || amr is null ||
            !await database.IsSessionValid(session, user, scope, stamp, amr))
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(context.Scheme.Name);
        }
    }
    public override Task RedirectToLogin(RedirectContext<CookieAuthenticationOptions> context)
    { context.Response.StatusCode = 401; return Task.CompletedTask; }
    public override Task RedirectToAccessDenied(RedirectContext<CookieAuthenticationOptions> context)
    { context.Response.StatusCode = 403; return Task.CompletedTask; }
}
