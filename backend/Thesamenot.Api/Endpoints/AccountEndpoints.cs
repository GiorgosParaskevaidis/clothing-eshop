using System.Security.Claims;
using Thesamenot.Api.Security;
using Thesamenot.Api.Validation;

namespace Thesamenot.Api.Endpoints;

public static class AccountEndpoints
{
    private static string UserId(HttpContext context) => context.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var account = endpoints.MapGroup("/api/account").RequireAuthorization(AuthorizationPolicies.Customer).RequireRateLimiting("public");
        account.MapGet("", (HttpContext context, StoreDatabase db) => db.CustomerProfile(UserId(context)));
        account.MapPut("", async (ProfileUpdate value, HttpContext context, StoreDatabase db) =>
        {
            AccountValidation.Profile(value); await db.UpdateProfile(UserId(context), value);
            return Results.Ok(await db.CustomerProfile(UserId(context)));
        });
        account.MapGet("/addresses", (HttpContext context, StoreDatabase db) => db.Addresses(UserId(context)));
        account.MapPost("/addresses", async (AddressUpdate value, HttpContext context, StoreDatabase db) =>
        {
            AccountValidation.Address(value); return Results.Ok(await db.SaveAddress(UserId(context), null, value));
        });
        account.MapPut("/addresses/{id}", async (string id, AddressUpdate value, HttpContext context, StoreDatabase db) =>
        {
            AccountValidation.Address(value); return Results.Ok(await db.SaveAddress(UserId(context), id, value));
        });
        account.MapDelete("/addresses/{id}", async (string id, int version, HttpContext context, StoreDatabase db) =>
        {
            if (version < 0) throw new StoreException(400, "Invalid version.");
            await db.DeleteAddress(UserId(context), id, version); return Results.NoContent();
        });
        account.MapGet("/orders", (int? page, int? pageSize, HttpContext context, StoreDatabase db) =>
        {
            var paging = AccountValidation.Pagination(page, pageSize);
            return db.CustomerOrders(UserId(context), paging.Page, paging.Size);
        });
        account.MapGet("/orders/{id}", async (string id, HttpContext context, StoreDatabase db) =>
            Results.Ok(CustomerOrderView.Detail(await db.CustomerOrder(UserId(context), id))));
        return endpoints;
    }
}
