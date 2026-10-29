using System.Security.Claims;
using Thesamenot.Api.Security;
using Thesamenot.Api.Services;
namespace Thesamenot.Api.Endpoints;

public static class OperationsEndpoints
{
    public static IEndpointRouteBuilder MapOperationsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var admin = endpoints.MapGroup("/api/admin/operations").RequireAuthorization(AuthorizationPolicies.Admin);
        admin.MapGet("/orders", (int? page, string? search, StoreDatabase db) => db.AdminOrderPage(page ?? 1, search));
        admin.MapGet("/orders/{id}", async (string id, StoreDatabase db) => new { order = CustomerOrderView.Detail(await db.AdminOrder(id)), operations = await db.OrderOperations(id, true) });
        admin.MapPost("/orders/{id}/ship", async (string id, ShipmentRequest request, HttpContext context, StoreDatabase db) => { await db.ShipOrder(id, request, CatalogEndpoints.Actor(context)); return Results.NoContent(); });
        admin.MapPost("/orders/{id}/confirm-payment", async (string id, ManualPaymentUpdate request, HttpContext context, StoreDatabase db) => { await db.ConfirmManualPayment(id, request, CatalogEndpoints.Actor(context)); return Results.NoContent(); });
        admin.MapPost("/orders/{id}/cancel", async (string id, ManualOrderCancellation request, HttpContext context, StoreDatabase db) => { await db.CancelManualOrder(id, request, CatalogEndpoints.Actor(context)); return Results.NoContent(); });
        admin.MapPost("/orders/{id}/refund", async (string id, RefundRequest request, HttpContext context, StoreDatabase db, Security.AuthenticationService auth) =>
        {
            await auth.AuthorizeRefund(context, new(request.ChallengeToken, request.Code));
            return Results.Accepted(value: new { id = await db.PrepareRefund(id, request, CatalogEndpoints.Actor(context)) });
        }).RequireRateLimiting("login");
        admin.MapPost("/returns/{id}/state", async (string id, ReturnUpdate request, HttpContext context, StoreDatabase db) => { await db.UpdateReturn(id, request, CatalogEndpoints.Actor(context)); return Results.NoContent(); });
        admin.MapPost("/returns/{id}/inspect", async (string id, ReturnInspection request, HttpContext context, StoreDatabase db) => { await db.InspectReturn(id, request, CatalogEndpoints.Actor(context)); return Results.NoContent(); });
        admin.MapGet("/jobs", (int? page, StoreDatabase db) => db.Jobs(page ?? 1));
        admin.MapGet("/health", async (StoreDatabase db, IConfiguration configuration) => new { operations = await db.OperationalHealth(), missingProductionSettings = Hosting.ProductionReadiness.Missing(configuration) });
        admin.MapPost("/jobs/{id}/replay", async (string id, HttpContext context, StoreDatabase db) => { await db.ReplayJob(id, CatalogEndpoints.Actor(context)); return Results.NoContent(); });
        endpoints.MapGet("/api/account/orders/{id}/operations", async (string id, HttpContext context, StoreDatabase db) =>
        {
            await db.CustomerOrder(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!, id); return Results.Ok(await db.OrderOperations(id));
        }).RequireAuthorization(AuthorizationPolicies.Customer).RequireRateLimiting("public");
        endpoints.MapPost("/api/account/returns", async (ReturnRequest request, HttpContext context, StoreDatabase db) =>
            Results.Ok(new { id = await db.CreateReturn(request, context.User.FindFirstValue(ClaimTypes.NameIdentifier), null) }))
            .RequireAuthorization(AuthorizationPolicies.Customer).RequireRateLimiting("account");
        endpoints.MapGet("/api/orders/access/operations", async (HttpContext context, StoreDatabase db, OrderAccessService service) =>
        {
            var order = await service.Current(context); return Results.Ok(await db.OrderOperations(order.Id));
        }).RequireRateLimiting("account");
        endpoints.MapPost("/api/orders/access/returns", async (ReturnRequest request, HttpContext context, StoreDatabase db, OrderAccessService service) =>
        {
            var order = await service.Current(context);
            if (request.OrderId != order.Id) throw new StoreException(404, "Order not found.");
            return Results.Ok(new { id = await db.CreateReturn(request, null, service.GrantId(context)) });
        }).RequireRateLimiting("account");
        return endpoints;
    }
}
