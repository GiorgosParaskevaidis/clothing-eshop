using System.Security.Claims;
using Thesamenot.Api.Security;
using Thesamenot.Api.Services;
using Thesamenot.Api.Validation;
using StoreAuth = Thesamenot.Api.Security.AuthenticationService;

namespace Thesamenot.Api.Endpoints;

public static class OrderAccessEndpoints
{
    public static IEndpointRouteBuilder MapOrderAccessEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var orders = endpoints.MapGroup("/api/orders").RequireRateLimiting("account");
        orders.MapPost("/access-link", async (OrderLinkRequest request, OrderAccessService service, CancellationToken ct) =>
        { await service.RequestLink(request, ct); return Results.Accepted(value: StoreAuth.Accepted()); });
        orders.MapPost("/access", async (TokenRequest request, HttpContext context, OrderAccessService service) =>
        { await service.Exchange(request.Token, context); return Results.NoContent(); });
        orders.MapGet("/access", async (HttpContext context, OrderAccessService service) =>
            Results.Ok(CustomerOrderView.Detail(await service.Current(context))));
        orders.MapPost("/claim", async (TokenRequest request, HttpContext context, StoreDatabase db) =>
        {
            var grant = await db.CompleteOrderAccess(AuthValidation.Token(request.Token), "claim", context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return Results.Ok(new { orderId = grant.OrderId });
        }).RequireAuthorization(AuthorizationPolicies.Customer);
        return endpoints;
    }
}
