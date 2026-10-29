using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Thesamenot.Api.Security;
using Thesamenot.Api.Validation;
using StoreAuth = Thesamenot.Api.Security.AuthenticationService;

namespace Thesamenot.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/auth/config", (IConfiguration config) => new { enabled = config.GetValue<bool>("Auth:Enabled") });
        endpoints.MapGet("/api/security/csrf", (HttpContext context, IAntiforgery antiforgery, IConfiguration config) =>
        {
            var principal = context.User;
            try
            {
                context.User = new ClaimsPrincipal(new ClaimsIdentity());
                return Results.Ok(new { token = antiforgery.GetAndStoreTokens(context).RequestToken, required = config.GetValue<bool>("Auth:Enabled") });
            }
            finally { context.User = principal; }
        });
        var auth = endpoints.MapGroup("/api/auth");
        auth.MapPost("/register", async (RegisterRequest request, HttpContext context, StoreAuth service, CancellationToken ct) =>
        { await service.Register(request, context, ct); return Results.Accepted(value: StoreAuth.Accepted()); }).RequireRateLimiting("account");
        auth.MapPost("/login", async (LoginRequest request, HttpContext context, StoreAuth service) =>
            Results.Ok(await service.Login(request, context, "Customer"))).RequireRateLimiting("login");
        auth.MapGet("/session", async (HttpContext context, StoreAuth service) => Results.Ok(await service.Session(context)))
            .RequireAuthorization(AuthorizationPolicies.Customer);
        auth.MapPost("/logout", async (HttpContext context, StoreAuth service) =>
        { await service.Logout(context); return Results.NoContent(); }).RequireAuthorization(AuthorizationPolicies.Customer);
        auth.MapPost("/verify-email", async (TokenRequest request, HttpContext context, StoreAuth service) =>
            Results.Ok(await service.ConfirmEmail(request, context))).RequireRateLimiting("account");
        auth.MapPost("/email/confirm", async (TokenRequest request, StoreAuth service) =>
        { await service.CompleteLink(request, "change-email"); return Results.NoContent(); }).RequireRateLimiting("account");
        auth.MapPost("/reset-password", async (ResetPasswordRequest request, StoreAuth service, CancellationToken ct) =>
        { await service.ResetPassword(request, ct); return Results.NoContent(); }).RequireRateLimiting("account");
        auth.MapPost("/resend-verification", async (EmailRequest request, StoreAuth service, CancellationToken ct) =>
        { await service.SendAccountLink(request, "verify-email", ct); return Results.Accepted(value: StoreAuth.Accepted()); }).RequireRateLimiting("account");
        auth.MapPost("/forgot-password", async (EmailRequest request, StoreAuth service, CancellationToken ct) =>
        { await service.SendAccountLink(request, "reset-password", ct); return Results.Accepted(value: StoreAuth.Accepted()); }).RequireRateLimiting("account");
        auth.MapPost("/password/change", async (ChangePasswordRequest request, HttpContext context, StoreAuth service) =>
        { await service.ChangePassword(context, request); return Results.NoContent(); }).RequireAuthorization(AuthorizationPolicies.Customer).RequireRateLimiting("login");
        auth.MapPost("/email/change", async (ChangeEmailRequest request, HttpContext context, StoreAuth service) =>
        { await service.ChangeEmail(context, request); return Results.Accepted(value: StoreAuth.Accepted()); }).RequireAuthorization(AuthorizationPolicies.Customer).RequireRateLimiting("login");
        auth.MapPost("/admin/mfa/setup", async (TokenRequest request, StoreAuth service) => Results.Ok(await service.MfaSetup(request)))
            .RequireRateLimiting("login");
        auth.MapPost("/admin/mfa/verify", async (MfaRequest request, HttpContext context, StoreAuth service) =>
            Results.Ok(await service.CompleteMfa(context, request))).RequireRateLimiting("login");
        var admin = auth.MapGroup("/admin").RequireAuthorization(AuthorizationPolicies.Admin);
        admin.MapPost("/reauth", async (ReauthRequest request, HttpContext context, StoreAuth service) =>
            Results.Ok(await service.BeginReauth(context, request))).RequireRateLimiting("login");
        admin.MapPost("/recovery-codes", async (MfaRequest request, HttpContext context, StoreAuth service) =>
            Results.Ok(await service.RecoveryCodes(context, request, false))).RequireRateLimiting("login");
        admin.MapPost("/mfa/reset", async (MfaRequest request, HttpContext context, StoreAuth service) =>
            Results.Ok(await service.RecoveryCodes(context, request, true))).RequireRateLimiting("login");
        admin.MapPost("/password/change", async (ChangePasswordRequest request, HttpContext context, StoreAuth service) =>
        { await service.ChangePassword(context, request); return Results.NoContent(); }).RequireRateLimiting("login");
        admin.MapPost("/email/change", async (ChangeEmailRequest request, HttpContext context, StoreAuth service) =>
        { await service.ChangeEmail(context, request); return Results.Accepted(value: StoreAuth.Accepted()); }).RequireRateLimiting("login");
        return endpoints;
    }
}
