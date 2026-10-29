using Microsoft.AspNetCore.Authentication;
using Thesamenot.Api.Security;
using Thesamenot.Api.Validation;

namespace Thesamenot.Api.Endpoints;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/admin/login", LoginAsync).RequireRateLimiting("login");

        var admin = endpoints.MapGroup("/api/admin").RequireAuthorization(AuthorizationPolicies.Admin);
        admin.MapGet("/session", GetSession);
        admin.MapPost("/logout", LogoutAsync);
        admin.MapGet("/products", GetProductsAsync);
        admin.MapPut("/products/{id}", UpdateProductAsync);
        admin.MapPut("/stock/{id}", UpdateStockAsync);
        admin.MapGet("/orders", GetOrdersAsync);
        admin.MapPost("/orders/{id}/fulfill", FulfillOrderAsync);
        admin.MapGet("/subscribers", GetSubscribersAsync);
        return endpoints;
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        HttpContext context,
        AdminAuthenticationService authentication,
        Security.AuthenticationService accounts,
        IConfiguration configuration)
    {
        if (configuration.GetValue<bool>("Auth:Enabled")) return Results.Ok(await accounts.Login(request, context, "Admin"));
        var principal = authentication.Authenticate(request);
        await context.SignInAsync(AuthorizationPolicies.LegacyScheme, principal);
        return Results.Ok(new { email = principal.Identity?.Name });
    }

    private static IResult GetSession(HttpContext context) =>
        Results.Ok(new { email = context.User.Identity?.Name });

    private static async Task<IResult> LogoutAsync(HttpContext context, Security.AuthenticationService accounts, IConfiguration configuration)
    {
        if (configuration.GetValue<bool>("Auth:Enabled")) await accounts.Logout(context);
        else await context.SignOutAsync(AuthorizationPolicies.LegacyScheme);
        return Results.Ok();
    }

    private static Task<List<Product>> GetProductsAsync(StoreDatabase database) => database.Products(true);

    private static async Task<IResult> UpdateProductAsync(string id, ProductUpdate request, StoreDatabase database)
    {
        RequestValidation.ValidateProduct(request);
        await database.UpdateProduct(id, request);
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateStockAsync(string id, StockUpdate request, HttpContext context, StoreDatabase database)
    {
        RequestValidation.ValidateStock(request);
        await database.UpdateStock(id, request, CatalogEndpoints.Actor(context));
        return Results.NoContent();
    }

    private static async Task<object> GetOrdersAsync(StoreDatabase database) => (await database.Orders()).Select(CustomerOrderView.Detail).ToList();

    private static async Task<IResult> FulfillOrderAsync(string id, StoreDatabase database)
    {
        await database.FulfillOrder(id);
        return Results.NoContent();
    }

    private static Task<object> GetSubscribersAsync(StoreDatabase database) => database.Subscribers();
}
