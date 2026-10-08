namespace Thesamenot.Api.Endpoints;

public static class PaymentEndpoints
{
    public static IEndpointRouteBuilder MapPaymentEndpoints(this IEndpointRouteBuilder endpoints, bool isDevelopment)
    {
        var payments = endpoints.MapGroup("/api/payments");
        payments.MapPost("/webhook", WebhookAsync);

        if (isDevelopment)
        {
            payments.MapPost("/simulation", CompleteSimulationAsync).RequireRateLimiting("public");
        }

        return endpoints;
    }

    private static async Task<IResult> WebhookAsync(HttpRequest request, Payments payments)
    {
        if (request.ContentLength > 1_000_000)
        {
            return Results.BadRequest();
        }

        using var reader = new StreamReader(request.Body);
        var json = await reader.ReadToEndAsync();

        try
        {
            await payments.Webhook(json, request.Headers["Stripe-Signature"].ToString());
        }
        catch (Stripe.StripeException)
        {
            return Results.BadRequest(new { message = "Invalid webhook signature." });
        }

        return Results.Ok();
    }

    private static async Task<IResult> CompleteSimulationAsync(UnsubscribeRequest request, Payments payments)
    {
        await payments.CompleteSimulation(request.Token);
        return Results.Ok();
    }
}
