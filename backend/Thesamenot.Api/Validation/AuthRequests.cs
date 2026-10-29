using System.Net.Mail;

namespace Thesamenot.Api.Validation;

public sealed record RegisterRequest(string Email, string Password, string DisplayName);
public sealed record EmailRequest(string Email);
public sealed record TokenRequest(string Token);
public sealed record ResetPasswordRequest(string Token, string Password);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record ChangeEmailRequest(string Email, string Password);
public sealed record MfaRequest(string ChallengeToken, string Code);
public sealed record ReauthRequest(string Password);

public static class AuthValidation
{
    public static string Email(string? value)
    {
        value = value?.Trim().Normalize();
        if (string.IsNullOrEmpty(value) || value.Length > 254 || !MailAddress.TryCreate(value, out var address) ||
            !string.Equals(address.Address, value, StringComparison.OrdinalIgnoreCase))
            throw new StoreException(400, "Enter a valid email address.");
        return value;
    }
    public static void PasswordInput(string? value)
    {
        if (string.IsNullOrEmpty(value) || value.Length > 512) throw new StoreException(400, "Invalid password input.");
    }
    public static string Token(string? value)
    {
        if (value is null || value.Length != 64 || !value.All(Uri.IsHexDigit)) throw new StoreException(400, "Invalid or expired link.");
        return value;
    }
    public static string Code(string? value)
    {
        value = value?.Replace(" ", "").Replace("-", "").ToUpperInvariant();
        if (value is null || value.Length is not (6 or 16)) throw new StoreException(401, "Invalid or expired verification code.");
        return value;
    }
}
