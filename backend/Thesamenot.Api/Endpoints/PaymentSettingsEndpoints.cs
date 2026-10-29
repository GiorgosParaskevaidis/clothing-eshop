using Thesamenot.Api.Security;
using Thesamenot.Api.Validation;

namespace Thesamenot.Api.Endpoints;

public static class PaymentSettingsEndpoints
{
    public static IEndpointRouteBuilder MapPaymentSettingsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var admin = endpoints.MapGroup("/api/admin/payment-settings").RequireAuthorization(AuthorizationPolicies.Admin);
        admin.MapGet("", (StoreDatabase db) => db.PaymentSettings());
        admin.MapPut("", async (PaymentSettingsUpdate request, HttpContext context, StoreDatabase db, AuthenticationService auth) =>
        {
            var value = PaymentSettingsValidation.Normalize(request);
            await auth.AuthorizePaymentSettings(context, new(request.ChallengeToken, request.Code));
            return Results.Ok(await db.SavePaymentSettings(value, CatalogEndpoints.Actor(context)));
        }).RequireRateLimiting("login");
        return endpoints;
    }
}
