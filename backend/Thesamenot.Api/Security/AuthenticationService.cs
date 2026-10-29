using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Thesamenot.Api.Security.Identity;
using Thesamenot.Api.Services;
using Thesamenot.Api.Validation;

namespace Thesamenot.Api.Security;

public sealed class AuthenticationService(UserManager<StoreUser> users, StoreDatabase database,
    IPasswordHasher<StoreUser> hasher, EmailService emailService, IConfiguration configuration,
    RegistrationContinuation registration)
{
    private const string InvalidLogin = "Invalid email, password or verification.";
    private static readonly StoreUser Dummy = new();
    private static readonly string DummyHash = new PasswordHasher<StoreUser>(
        Microsoft.Extensions.Options.Options.Create(new PasswordHasherOptions { IterationCount = 210000 }))
        .HashPassword(Dummy, Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));
    public static object Accepted() => new { message = "If this address can receive the requested message, instructions will be sent." };
    private void Enabled()
    {
        if (!configuration.GetValue<bool>("Auth:Enabled")) throw new StoreException(404, "Customer accounts are not enabled in this demo.");
    }
    private async Task TargetLimit(string purpose, string email)
    {
        if (!await database.TakeAuthTargetLimit(purpose + ":" + email.ToUpperInvariant()))
            throw new StoreException(429, "Too many requests. Please retry later.");
    }
    private async Task ValidatePassword(StoreUser user, string password)
    {
        AuthValidation.PasswordInput(password);
        foreach (var validator in users.PasswordValidators)
        {
            var result = await validator.ValidateAsync(users, user, password);
            if (!result.Succeeded) throw new StoreException(400, StorePasswordValidator.Description);
        }
    }
    public async Task Register(RegisterRequest request, HttpContext context, CancellationToken ct)
    {
        Enabled();
        var email = AuthValidation.Email(request.Email);
        if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Trim().Length > 120)
            throw new StoreException(400, "Enter your name (up to 120 characters).");
        var user = new StoreUser { Email = email, UserName = email, DisplayName = request.DisplayName.Trim() };
        await ValidatePassword(user, request.Password);
        await TargetLimit("register", email);
        // Do comparable password work even for an existing address; never return duplicate-email details.
        var passwordHash = hasher.HashPassword(user, request.Password);
        var existing = await users.FindByEmailAsync(email);
        // Every accepted request gets an indistinguishable cookie, including duplicates.
        if (existing is not null) { registration.Begin(context, user); return; }
        user.PasswordHash = passwordHash;
        var created = (await users.CreateAsync(user)).Succeeded;
        // Identity assigns the final security stamp during CreateAsync.
        registration.Begin(context, user);
        if (!created) return;
        await emailService.FlushDevelopmentKey("email:registration:" + user.Id, ct);
    }
    public async Task<object> Login(LoginRequest request, HttpContext context, string scope)
    {
        Enabled();
        var email = AuthValidation.Email(request.Email);
        AuthValidation.PasswordInput(request.Password);
        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            hasher.VerifyHashedPassword(Dummy, DummyHash, request.Password);
            throw new StoreException(401, InvalidLogin);
        }
        var passwordValid = await users.CheckPasswordAsync(user, request.Password);
        if (!passwordValid)
        {
            await database.RecordLoginFailure(user.Id);
            throw new StoreException(401, InvalidLogin);
        }
        if (!user.Enabled || !user.EmailConfirmed || user.LockoutEndUtc > DateTime.UtcNow ||
            !(await users.GetRolesAsync(user)).Contains(scope))
            throw new StoreException(401, InvalidLogin);
        await database.ResetLoginFailures(user.Id);
        user = (await users.FindByIdAsync(user.Id))!;
        if (scope == "Admin")
        {
            if (!user.TwoFactorEnabled && await users.GetAuthenticatorKeyAsync(user) is null)
            {
                if (!(await users.ResetAuthenticatorKeyAsync(user)).Succeeded) throw new StoreException(409, "Account changed. Retry sign in.");
            }
            var purpose = user.TwoFactorEnabled ? "admin-mfa-login" : "admin-mfa-setup";
            return new
            {
                requiresMfa = true,
                requiresSetup = !user.TwoFactorEnabled,
                challengeToken = await database.IssueActionToken(user, purpose, TimeSpan.FromMinutes(5))
            };
        }
        await SignIn(context, user, scope);
        return new { email = user.Email, displayName = user.DisplayName };
    }
    private async Task SignIn(HttpContext context, StoreUser user, string scope, string customerMethod = "pwd")
    {
        var sessionId = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expires = DateTime.UtcNow.AddHours(scope == "Admin" ? 2 : 24);
        var amr = scope == "Admin" ? "mfa" : customerMethod;
        await database.CreateSession(sessionId, user, scope, amr, expires);
        var scheme = scope == "Admin" ? AuthorizationPolicies.AdminScheme : AuthorizationPolicies.CustomerScheme;
        var principal = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier,user.Id),new Claim(ClaimTypes.Name,user.Email!),
            new Claim(ClaimTypes.Role,scope),new Claim("security_stamp",user.SecurityStamp!),
            new Claim("sid",sessionId),new Claim("store_scope",scope),new Claim("amr",amr)
        ], scheme));
        await context.SignInAsync(scheme, principal, new AuthenticationProperties
        { IsPersistent = false, ExpiresUtc = new DateTimeOffset(expires, TimeSpan.Zero) });
    }
    public async Task Logout(HttpContext context)
    {
        var scope = context.User.FindFirstValue("store_scope")!;
        await database.RevokeSessions(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!, context.User.FindFirstValue("sid"));
        await context.SignOutAsync(scope == "Admin" ? AuthorizationPolicies.AdminScheme : AuthorizationPolicies.CustomerScheme);
    }
    public async Task<object> Session(HttpContext context)
    {
        var user = (await users.FindByIdAsync(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!))!;
        return new
        {
            id = user.Id,
            email = user.Email,
            displayName = user.DisplayName,
            emailConfirmed = user.EmailConfirmed,
            scope = context.User.FindFirstValue("store_scope")
        };
    }
    public async Task SendAccountLink(EmailRequest request, string purpose, CancellationToken ct)
    {
        Enabled();
        var email = AuthValidation.Email(request.Email);
        await TargetLimit(purpose, email);
        var user = await users.FindByEmailAsync(email);
        if (user is null || !user.Enabled || (purpose == "verify-email" && user.EmailConfirmed)) return;
        var lifetime = purpose == "reset-password" ? TimeSpan.FromMinutes(15) : TimeSpan.FromHours(24);
        var token = await database.IssueActionToken(user, purpose, lifetime, queueMail: true);
        await emailService.FlushDevelopmentKey("email:action:" + StoreDatabase.SecretHash(token), ct);
    }
    public async Task CompleteLink(TokenRequest request, string purpose)
    {
        Enabled();
        if (!await database.CompleteAccountAction(AuthValidation.Token(request.Token), purpose))
            throw new StoreException(400, "Invalid or expired link.");
    }
    public async Task<object> ConfirmEmail(TokenRequest request, HttpContext context)
    {
        Enabled();
        var token = AuthValidation.Token(request.Token);
        var action = await database.GetActionToken(token, "verify-email");
        var before = action is null ? null : await users.FindByIdAsync(action.UserId);
        if (before is null) throw new StoreException(400, "Invalid or expired link.");
        // Completion is atomic and checks expiry, single use, enabled state and stamp.
        await CompleteLink(request, "verify-email");
        var user = await users.FindByIdAsync(before.Id);
        if (user is null) return new { signedIn = false };
        var browserMatches = registration.Consume(context, user);
        var roles = await users.GetRolesAsync(user);
        var currentUser = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var signedIn = browserMatches && !before.EmailConfirmed && user.Enabled && user.EmailConfirmed &&
            user.SecurityStamp == action!.SecurityStamp && !(user.LockoutEndUtc > DateTime.UtcNow) &&
            !user.TwoFactorEnabled && roles.Contains("Customer") && !roles.Contains("Admin") &&
            (currentUser is null || currentUser == user.Id);
        if (signedIn) await SignIn(context, user, "Customer", "email");
        return new { signedIn };
    }
    public async Task ResetPassword(ResetPasswordRequest request, CancellationToken ct)
    {
        Enabled();
        var token = AuthValidation.Token(request.Token);
        var action = await database.GetActionToken(token, "reset-password");
        if (action is null) throw new StoreException(400, "Invalid or expired link.");
        var user = await users.FindByIdAsync(action.UserId);
        if (user is null) throw new StoreException(400, "Invalid or expired link.");
        await ValidatePassword(user, request.Password);
        if (!await database.CompleteAccountAction(token, "reset-password", hasher.HashPassword(user, request.Password)))
            throw new StoreException(400, "Invalid or expired link.");
        await emailService.FlushDevelopmentKey("email:security:" + StoreDatabase.SecretHash(token), ct);
    }
    private async Task<StoreUser> Current(HttpContext context, string password)
    {
        var user = (await users.FindByIdAsync(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!))!;
        AuthValidation.PasswordInput(password);
        if (user.LockoutEndUtc > DateTime.UtcNow || !await users.CheckPasswordAsync(user, password))
        {
            await database.RecordLoginFailure(user.Id);
            throw new StoreException(401, InvalidLogin);
        }
        return user;
    }
    public async Task ChangePassword(HttpContext context, ChangePasswordRequest request)
    {
        var user = await Current(context, request.CurrentPassword);
        await ValidatePassword(user, request.NewPassword);
        if (!(await users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword)).Succeeded)
            throw new StoreException(409, "Account changed. Please retry.");
        await database.RevokeSessions(user.Id);
        await Logout(context);
        await emailService.Send(user.Email!, "password-changed", ct: context.RequestAborted);
    }
    public async Task ChangeEmail(HttpContext context, ChangeEmailRequest request)
    {
        var user = await Current(context, request.Password);
        var target = AuthValidation.Email(request.Email);
        await TargetLimit("change-email", target);
        var token = await database.IssueActionToken(user, "change-email", TimeSpan.FromMinutes(30), target, true);
        await emailService.FlushDevelopmentKey("email:action:" + StoreDatabase.SecretHash(token), context.RequestAborted);
        await emailService.FlushDevelopmentKey("email:change-notice:" + StoreDatabase.SecretHash(token), context.RequestAborted);
    }
    private async Task<(StoreUser User, string Purpose)> Challenge(string raw, string? expected = null)
    {
        Enabled();
        AuthValidation.Token(raw);
        foreach (var purpose in expected is null ? new[] { "admin-mfa-login", "admin-mfa-setup" } : [expected])
        {
            var action = await database.GetActionToken(raw, purpose);
            if (action is null) continue;
            var user = await users.FindByIdAsync(action.UserId);
            if (user is not null && user.Enabled && user.EmailConfirmed && user.SecurityStamp == action.SecurityStamp &&
                (user.LockoutEndUtc is null || user.LockoutEndUtc <= DateTime.UtcNow))
            {
                if ((await users.GetRolesAsync(user!)).Contains("Admin")) return (user!, purpose);
            }
        }
        throw new StoreException(401, "Invalid or expired verification.");
    }
    public async Task<object> MfaSetup(TokenRequest request)
    {
        var (user, _) = await Challenge(request.Token, "admin-mfa-setup");
        var key = await users.GetAuthenticatorKeyAsync(user);
        if (user.TwoFactorEnabled || key is null) throw new StoreException(409, "MFA setup is unavailable.");
        return new
        {
            key,
            authenticatorUri = "otpauth://totp/" + Uri.EscapeDataString("thesamenot:" + user.Email) +
            "?secret=" + key + "&issuer=thesamenot&digits=6&period=30"
        };
    }
    private async Task<(long? Step, string? Recovery)> MfaProof(StoreUser user, string purpose, string code)
    {
        code = AuthValidation.Code(code);
        if (code.Length == 6 && await users.VerifyTwoFactorTokenAsync(user, TokenOptions.DefaultAuthenticatorProvider, code))
            return (Totp.MatchingStep((await users.GetAuthenticatorKeyAsync(user))!, code), null);
        if (purpose != "admin-mfa-setup" && code.Length == 16) return (null, code);
        return (null, null);
    }
    private static string[] NewCodes() => Enumerable.Range(0, 10).Select(_ => Convert.ToHexString(RandomNumberGenerator.GetBytes(8))).ToArray();
    public async Task<object> CompleteMfa(HttpContext context, MfaRequest request)
    {
        var (user, purpose) = await Challenge(request.ChallengeToken);
        var proof = await MfaProof(user, purpose, request.Code);
        var codes = purpose == "admin-mfa-setup" ? NewCodes() : null;
        if (!await database.CompleteMfaChallenge(request.ChallengeToken, purpose, user, proof.Step, proof.Recovery, codes))
        {
            await database.FailChallenge(request.ChallengeToken);
            await database.RecordLoginFailure(user.Id);
            throw new StoreException(401, "Invalid, expired or already used verification code.");
        }
        await SignIn(context, user, "Admin");
        return new { email = user.Email, recoveryCodes = codes };
    }
    public async Task<object> BeginReauth(HttpContext context, ReauthRequest request)
    {
        var user = await Current(context, request.Password);
        return new { challengeToken = await database.IssueActionToken(user, "admin-mfa-reauth", TimeSpan.FromMinutes(5)) };
    }
    public async Task<object> RecoveryCodes(HttpContext context, MfaRequest request, bool resetMfa)
    {
        var (user, purpose) = await Challenge(request.ChallengeToken, "admin-mfa-reauth");
        if (context.User.FindFirstValue(ClaimTypes.NameIdentifier) != user.Id) throw new StoreException(403, "Invalid verification.");
        var proof = await MfaProof(user, purpose, request.Code);
        var codes = resetMfa ? null : NewCodes();
        if (!await database.CompleteMfaChallenge(request.ChallengeToken, purpose, user, proof.Step, proof.Recovery, codes))
        {
            await database.FailChallenge(request.ChallengeToken); await database.RecordLoginFailure(user.Id);
            throw new StoreException(401, "Invalid, expired or already used verification code.");
        }
        if (!resetMfa) return new { recoveryCodes = codes };
        if (!(await users.SetTwoFactorEnabledAsync(user, false)).Succeeded ||
            !(await users.ResetAuthenticatorKeyAsync(user)).Succeeded) throw new StoreException(409, "Account changed. Retry sign in.");
        await database.RevokeSessions(user.Id);
        await context.SignOutAsync(AuthorizationPolicies.AdminScheme);
        await emailService.Send(user.Email!, "mfa-reset", ct: context.RequestAborted);
        return new
        {
            requiresMfa = true,
            requiresSetup = true,
            challengeToken = await database.IssueActionToken(user, "admin-mfa-setup", TimeSpan.FromMinutes(5))
        };
    }
    public Task AuthorizeRefund(HttpContext context, MfaRequest request) =>
        AuthorizeAdminChange(context, request, "A fresh password and MFA verification is required for this refund.");

    public Task AuthorizePaymentSettings(HttpContext context, MfaRequest request) =>
        AuthorizeAdminChange(context, request, "A fresh password and MFA verification is required to change payment settings.");

    private async Task AuthorizeAdminChange(HttpContext context, MfaRequest request, string failure)
    {
        var (user, purpose) = await Challenge(request.ChallengeToken, "admin-mfa-reauth");
        if (context.User.FindFirstValue(ClaimTypes.NameIdentifier) != user.Id) throw new StoreException(403, "Invalid verification.");
        var proof = await MfaProof(user, purpose, request.Code);
        if (!await database.CompleteMfaChallenge(request.ChallengeToken, purpose, user, proof.Step, proof.Recovery, null))
        {
            await database.FailChallenge(request.ChallengeToken); await database.RecordLoginFailure(user.Id);
            throw new StoreException(401, failure);
        }
    }
}
