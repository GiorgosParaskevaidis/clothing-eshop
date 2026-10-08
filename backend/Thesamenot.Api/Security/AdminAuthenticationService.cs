using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;

namespace Thesamenot.Api.Security;

public sealed class AdminAuthenticationService(IConfiguration configuration)
{
    private readonly PasswordHasher<string> passwordHasher = new();

    public ClaimsPrincipal Authenticate(LoginRequest request)
    {
        var email = configuration["Admin:Email"];
        var hash = configuration["Admin:PasswordHash"];

        if (string.IsNullOrWhiteSpace(hash) || request.Email != email ||
            passwordHasher.VerifyHashedPassword(email ?? "", hash, request.Password) == PasswordVerificationResult.Failed)
        {
            throw new StoreException(401, "Invalid email or password.");
        }

        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.Name, email!)],
            CookieAuthenticationDefaults.AuthenticationScheme);
        return new ClaimsPrincipal(identity);
    }
}
