namespace Thesamenot.Api.Endpoints;

public static class StoreEndpoints
{
    public static IEndpointRouteBuilder MapStoreEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api");
        api.MapGet("/health", GetHealthAsync);
        api.MapGet("/store", GetStore);
        api.MapGet("/products", GetProductsAsync);
        return endpoints;
    }

    private static async Task<IResult> GetHealthAsync(StoreDatabase database)
    {
        await database.ServerVersion();
        return Results.Ok(new { status = "healthy" });
    }

    private static async Task<IResult> GetStore(StoreOptions options, StoreDatabase database, IWebHostEnvironment environment)
    {
        var shipping = await database.Shipping();
        var payments = await database.PaymentSettings();
        return Results.Ok(new
        {
            brand = "thesamenot",
            options.DropOpensAt,
            options.SalesEnabled,
            shippingCents = shipping.CostCents,
            freeShippingThresholdCents = shipping.FreeFromCents,
            options.InstagramUrl,
            options.ContactEmail,
            checkoutAvailable = true,
            simulation = false,
            preview = environment.IsEnvironment("Preview"),
            paymentMethods = new[] {
                new { id = ManualPaymentMethods.BankTransfer, name = "Bank transfer to Revolut", available = ManualPaymentMethods.BankReady(payments),
                    unavailableReason = !ManualPaymentMethods.BankDetailsValid(payments) ? "NotConfigured" : !payments.BankTransferEnabled ? "Disabled" : (string?)null },
                new { id = ManualPaymentMethods.CashOnDelivery, name = "Cash on delivery", available = true, unavailableReason = (string?)null }
            }
        });
    }

    private static Task<List<Product>> GetProductsAsync(StoreDatabase database) => database.Products();
}
