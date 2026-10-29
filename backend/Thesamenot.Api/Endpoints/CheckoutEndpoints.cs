using Thesamenot.Api.Validation;
using Thesamenot.Api.Security;

namespace Thesamenot.Api.Endpoints;

public static class CheckoutEndpoints
{
    public static IEndpointRouteBuilder MapCheckoutEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api").RequireRateLimiting("public");
        api.MapPost("/checkout", CheckoutAsync);
        api.MapGet("/checkout/context", (HttpContext context, CheckoutIdentity identity) =>
        {
            var owner = identity.Resolve(context, true);
            return Results.Ok(new { customer = owner.UserId is not null, email = owner.Email });
        });
        api.MapGet("/orders/{token}", GetOrderAsync);
        return endpoints;
    }

    private static async Task<IResult> CheckoutAsync(CheckoutRequest request, Payments payments, HttpContext context, CheckoutIdentity identity)
    {
        RequestValidation.ValidateCheckout(request);
        return Results.Ok(await payments.ManualCheckout(request, identity.Resolve(context)));
    }

    private static async Task<IResult> GetOrderAsync(string token, StoreDatabase database)
    {
        var order = await database.PublicOrder(token) ?? throw new StoreException(404, "Order not found.");
        return Results.Ok(new
        {
            number = order.OrderNumber,
            order.Status,
            order.PaymentMode,
            order.PaymentStatus,
            paymentInstructions = ManualPaymentMethods.SnapshotInstructions(order),
            order.TotalCents,
            order.ShippingCents,
            order.Items
        });
    }
}
