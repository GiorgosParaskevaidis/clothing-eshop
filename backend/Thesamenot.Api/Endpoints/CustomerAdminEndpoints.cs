using System.Security.Claims;
using Thesamenot.Api.Security;
using Thesamenot.Api.Validation;
using StoreAuth = Thesamenot.Api.Security.AuthenticationService;

namespace Thesamenot.Api.Endpoints;

public static class CustomerAdminEndpoints
{
    public static IEndpointRouteBuilder MapCustomerAdminEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var users = endpoints.MapGroup("/api/admin/users").RequireAuthorization(AuthorizationPolicies.Admin).RequireRateLimiting("public");
        users.MapGet("", (int? page, int? pageSize, string? search, StoreDatabase db) =>
        {
            if (search?.Length > 100) throw new StoreException(400, "Search is too long.");
            var paging = AccountValidation.Pagination(page, pageSize);
            return db.Customers(paging.Page, paging.Size, search);
        });
        users.MapGet("/{id}/orders", (string id, int? page, int? pageSize, StoreDatabase db) =>
        {
            var paging = AccountValidation.Pagination(page, pageSize);
            return db.CustomerOrders(id, paging.Page, paging.Size);
        });
        users.MapPost("/{id}/disable", async (string id, HttpContext context, StoreDatabase db) =>
        {
            await db.SetCustomerEnabled(id, false, context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return Results.NoContent();
        });
        users.MapPost("/{id}/enable", async (string id, HttpContext context, StoreDatabase db) =>
        {
            await db.SetCustomerEnabled(id, true, context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return Results.NoContent();
        });
        users.MapPost("/{id}/reset-link", async (string id, StoreDatabase db, StoreAuth auth, CancellationToken ct) =>
        {
            var user = await db.CustomerById(id);
            await auth.SendAccountLink(new EmailRequest(user.Email), "reset-password", ct);
            return Results.Accepted(value: StoreAuth.Accepted());
        });
        return endpoints;
    }
}
