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
        var version = await database.ServerVersion();
        return Results.Ok(new { status = "healthy", database = version });
    }

    private static IResult GetStore(StoreOptions options, Payments payments) => Results.Ok(new
    {
        brand = "thesamenot",
        options.DropOpensAt,
        options.SalesEnabled,
        options.ShippingCents,
        options.FreeShippingThresholdCents,
        options.InstagramUrl,
        options.ContactEmail,
        checkoutAvailable = payments.Ready,
        simulation = payments.IsSimulation
    });

    private static Task<List<Product>> GetProductsAsync(StoreDatabase database) => database.Products();
}
