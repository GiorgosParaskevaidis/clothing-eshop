using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Thesamenot.Api.Security.Identity;

namespace Thesamenot.Api.Security;

// The confirmation link and the browser that created the account must both
// participate before verification may create a customer session.
public sealed class RegistrationContinuation(IDataProtectionProvider protection, IWebHostEnvironment environment)
{
    private readonly ITimeLimitedDataProtector protector = protection
        .CreateProtector("thesamenot.registration-continuation.v1").ToTimeLimitedDataProtector();
    private string CookieName => environment.IsDevelopment() ? "tsn_registration" : "__Host-tsn_registration";
    private CookieOptions Options(HttpContext context) => new()
    {
        HttpOnly = true,
        Secure = !environment.IsDevelopment() || context.Request.IsHttps,
        SameSite = SameSiteMode.Strict,
        Path = "/",
        IsEssential = true
    };

    public void Begin(HttpContext context, StoreUser user)
    {
        var lifetime = TimeSpan.FromHours(24);
        var options = Options(context);
        options.MaxAge = lifetime;
        context.Response.Cookies.Append(CookieName,
            protector.Protect(user.Id + ":" + user.SecurityStamp, lifetime), options);
    }

    public bool Consume(HttpContext context, StoreUser user)
    {
        var value = context.Request.Cookies[CookieName];
        context.Response.Cookies.Delete(CookieName, Options(context));
        if (string.IsNullOrEmpty(value) || value.Length > 1024) return false;
        try
        {
            return protector.Unprotect(value, out _) == user.Id + ":" + user.SecurityStamp;
        }
        catch (Exception error) when (error is CryptographicException or FormatException) { return false; }
    }
}
