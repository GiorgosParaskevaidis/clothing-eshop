using Thesamenot.Api.Security;
using Thesamenot.Api.Services;
namespace Thesamenot.Api.Endpoints;

public static class MediaEndpoints
{
    public static IEndpointRouteBuilder MapMediaEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/media/{key}", (string key, StoreDatabase db, ProductMediaService media, CancellationToken ct) => Read(key, false, db, media, ct)).RequireRateLimiting("media");
        endpoints.MapGet("/api/admin/media/{key}", (string key, StoreDatabase db, ProductMediaService media, CancellationToken ct) => Read(key, true, db, media, ct)).RequireAuthorization(AuthorizationPolicies.Admin);
        endpoints.MapPost("/api/admin/catalog/{id}/images", async (string id, int version, string alt, int position, HttpContext context, StoreDatabase db, ProductMediaService media, CancellationToken ct) =>
        {
            await db.CatalogProduct(id, true);
            var image = await media.Upload(context.Request.Body, context.Request.ContentType ?? "", ct);
            try { await db.AddProductImage(id, image.Key, alt, position, image.Width, image.Height, version, CatalogEndpoints.Actor(context)); }
            catch { await media.Delete(image.Key, ct); throw; }
            return Results.Ok(new { key = image.Key, width = image.Width, height = image.Height });
        }).RequireAuthorization(AuthorizationPolicies.Admin).RequireRateLimiting("account");
        endpoints.MapPut("/api/admin/catalog/{productId}/images/{id}", async (string productId, string id, ProductImageEdit request, HttpContext context, StoreDatabase db) =>
        {
            await db.EditProductImage(productId, id, request, CatalogEndpoints.Actor(context)); return Results.NoContent();
        }).RequireAuthorization(AuthorizationPolicies.Admin);
        endpoints.MapDelete("/api/admin/catalog/{productId}/images/{id}", async (string productId, string id, int version, HttpContext context, StoreDatabase db) =>
        {
            await db.EditProductImage(productId, id, new("Removed image", 0, version), CatalogEndpoints.Actor(context), true); return Results.NoContent();
        }).RequireAuthorization(AuthorizationPolicies.Admin);
        return endpoints;
    }
    private static async Task<IResult> Read(string key, bool admin, StoreDatabase db, ProductMediaService media, CancellationToken ct)
    {
        if (!await db.MediaVisible(key, admin)) throw new StoreException(404, "Image not found.");
        return Results.File(await media.Read(key, ct), "image/webp");
    }
}
