using Thesamenot.Api.Validation;

namespace Thesamenot.Api.Endpoints;

public static class CheckoutEndpoints
{
    public static IEndpointRouteBuilder MapCheckoutEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api").RequireRateLimiting("public");
        api.MapPost("/checkout", CheckoutAsync);
        api.MapGet("/orders/{token}", GetOrderAsync);
        return endpoints;
    }

    private static async Task<IResult> CheckoutAsync(CheckoutRequest request, Payments payments)
    {
        RequestValidation.ValidateCheckout(request);
        return Results.Ok(await payments.Checkout(request));
    }

    private static async Task<IResult> GetOrderAsync(string token, StoreDatabase database)
    {
        var order = await database.PublicOrder(token) ?? throw new StoreException(404, "Order not found.");
        return Results.Ok(new
        {
            number = order.Id[..8].ToUpperInvariant(),
            order.Status,
            order.PaymentMode,
            order.TotalCents,
            order.ShippingCents,
            order.Items
        });
    }
}
