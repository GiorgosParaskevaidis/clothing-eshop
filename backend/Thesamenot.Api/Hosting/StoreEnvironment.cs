namespace Thesamenot.Api.Hosting;

public static class StoreEnvironment
{
    public static bool IsStorePreview(this IHostEnvironment environment) =>
        environment.IsEnvironment("Preview");

    public static bool AllowsPaymentSimulation(this IHostEnvironment environment) =>
        environment.IsDevelopment() || environment.IsStorePreview();
}
