using Thesamenot.Api.Middleware;

namespace Thesamenot.Api.Hosting;

public static class ApplicationExtensions
{
    public static WebApplication UseStorePipeline(this WebApplication app)
    {
        app.UseForwardedHeaders();
        app.UseCors();
        app.UseMiddleware<StoreRequestMiddleware>();
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseMiddleware<StoreAntiforgeryMiddleware>();
        app.UseAuthorization();
        return app;
    }

    public static async Task InitializeStoreDatabaseAsync(this WebApplication app)
    {
        if (app.Configuration.GetValue<bool>("Database:Initialize"))
            throw new InvalidOperationException("Runtime DDL is disabled. Apply migrations with StoreMaintenance.");
        await app.Services.GetRequiredService<StoreDatabase>().VerifyRuntimeSchema(app.Environment.ContentRootPath);
        await ProductionReadiness.Validate(app);
        app.Services.GetRequiredService<Thesamenot.Api.Services.ProductMediaService>();
        if (app.Configuration.GetValue<bool>("Auth:Enabled"))
        {
            app.Services.GetRequiredService<Security.Identity.StorePasswordValidator>();
            await app.Services.GetRequiredService<StoreDatabase>().VerifyIdentitySchema();
        }
    }
}
