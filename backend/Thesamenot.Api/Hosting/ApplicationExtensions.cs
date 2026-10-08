using Thesamenot.Api.Middleware;

namespace Thesamenot.Api.Hosting;

public static class ApplicationExtensions
{
    public static WebApplication UseStorePipeline(this WebApplication app)
    {
        app.UseForwardedHeaders();
        app.UseMiddleware<StoreRequestMiddleware>();
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();
        return app;
    }

    public static async Task InitializeStoreDatabaseAsync(this WebApplication app)
    {
        if (app.Configuration.GetValue<bool>("Database:Initialize"))
        {
            var database = app.Services.GetRequiredService<StoreDatabase>();
            await database.Initialize(app.Environment.ContentRootPath);
        }
    }
}
