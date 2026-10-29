using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace Thesamenot.Api.Security;

public sealed class CheckoutIdentity(IDataProtectionProvider protection, IWebHostEnvironment environment)
{
    private readonly ITimeLimitedDataProtector protector = protection.CreateProtector("thesamenot.checkout-owner.v1").ToTimeLimitedDataProtector();
    private string Name => environment.IsDevelopment() ? "tsn_checkout" : "__Host-tsn_checkout";
    private CookieOptions Options(HttpContext context) => new()
    {
        Path = "/",
        HttpOnly = true,
        IsEssential = true,
        SameSite = SameSiteMode.Lax,
        Secure = !environment.IsDevelopment() || context.Request.IsHttps,
        MaxAge = TimeSpan.FromDays(7)
    };
    public CheckoutOwner Resolve(HttpContext context, bool initialize = false)
    {
        if (context.User.FindFirstValue("store_scope") == "Customer" &&
            context.User.FindFirstValue(ClaimTypes.NameIdentifier) is { } id)
            return new("customer:" + id, id, context.User.FindFirstValue(ClaimTypes.Name));
        var cookie = context.Request.Cookies[Name];
        if (cookie is { Length: < 1024 })
        {
            try
            {
                var subject = protector.Unprotect(cookie, out _);
                if (subject.Length == 64 && subject.All(Uri.IsHexDigit))
                    return new("guest:" + StoreDatabase.SecretHash(subject), null, null);
            }
            catch (Exception error) when (error is CryptographicException or FormatException) { }
        }
        if (!initialize) throw new StoreException(409, "Reload checkout to initialize a secure checkout session.");
        var secret = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        context.Response.Cookies.Append(Name, protector.Protect(secret, TimeSpan.FromDays(7)), Options(context));
        return new("guest:" + StoreDatabase.SecretHash(secret), null, null);
    }
}
