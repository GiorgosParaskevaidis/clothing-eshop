using Thesamenot.Api.Security;
namespace Thesamenot.Api.Endpoints;

public static class ShippingEndpoints
{
    public static IEndpointRouteBuilder MapShippingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/checkout/quote", (QuoteRequest request, HttpContext context, CheckoutIdentity identity, StoreDatabase db) => db.CreateQuote(request, identity.Resolve(context))).RequireRateLimiting("public");
        endpoints.MapGet("/api/admin/shipping", (StoreDatabase db) => db.Shipping()).RequireAuthorization(AuthorizationPolicies.Admin);
        endpoints.MapPut("/api/admin/shipping", async (ShippingSettings request, HttpContext context, StoreDatabase db) =>
        {
            await db.SaveShipping(request, CatalogEndpoints.Actor(context)); return Results.NoContent();
        }).RequireAuthorization(AuthorizationPolicies.Admin);
        return endpoints;
    }
}
