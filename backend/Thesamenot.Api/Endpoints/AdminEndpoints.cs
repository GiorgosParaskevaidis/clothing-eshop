using Microsoft.AspNetCore.Authentication;
using Thesamenot.Api.Security;
using Thesamenot.Api.Validation;

namespace Thesamenot.Api.Endpoints;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/admin/login", LoginAsync).RequireRateLimiting("login");

        var admin = endpoints.MapGroup("/api/admin").RequireAuthorization();
        admin.MapGet("/session", GetSession);
        admin.MapPost("/logout", (Func<HttpContext, Task<IResult>>)LogoutAsync);
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
        AdminAuthenticationService authentication)
    {
        var principal = authentication.Authenticate(request);
        await context.SignInAsync(principal);
        return Results.Ok(new { email = principal.Identity?.Name });
    }

    private static IResult GetSession(HttpContext context) =>
        Results.Ok(new { email = context.User.Identity?.Name });

    private static async Task<IResult> LogoutAsync(HttpContext context)
    {
        await context.SignOutAsync();
        return Results.Ok();
    }

    private static Task<List<Product>> GetProductsAsync(StoreDatabase database) => database.Products(true);

    private static async Task<IResult> UpdateProductAsync(string id, ProductUpdate request, StoreDatabase database)
    {
        RequestValidation.ValidateProduct(request);
        await database.UpdateProduct(id, request);
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateStockAsync(string id, StockUpdate request, StoreDatabase database)
    {
        RequestValidation.ValidateStock(request);
        await database.UpdateStock(id, request);
        return Results.NoContent();
    }

    private static Task<List<Order>> GetOrdersAsync(StoreDatabase database) => database.Orders();

    private static async Task<IResult> FulfillOrderAsync(string id, StoreDatabase database)
    {
        await database.FulfillOrder(id);
        return Results.NoContent();
    }

    private static Task<object> GetSubscribersAsync(StoreDatabase database) => database.Subscribers();
}
