using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Thesamenot.Api.Security;
namespace Thesamenot.Api.Endpoints;

public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/catalog/sitemap", (int? page, StoreDatabase db) => db.SitemapProducts(page ?? 1)).RequireRateLimiting("catalog");
        endpoints.MapGet("/api/catalog", ([AsParameters] CatalogQuery query, StoreDatabase db) => db.Catalog(query)).RequireRateLimiting("public");
        endpoints.MapGet("/api/products/{slug}", (string slug, StoreDatabase db) => db.CatalogProduct(slug)).RequireRateLimiting("public");
        endpoints.MapGet("/api/basket/products", (string? ids, StoreDatabase db) => db.BasketProducts((ids ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries))).RequireRateLimiting("public");
        endpoints.MapGet("/api/categories", (StoreDatabase db) => db.Categories()).RequireRateLimiting("public");
        var admin = endpoints.MapGroup("/api/admin/catalog").RequireAuthorization(AuthorizationPolicies.Admin);
        admin.MapGet("/", ([AsParameters] CatalogQuery query, StoreDatabase db) => db.Catalog(query, true));
        admin.MapGet("/{id}", (string id, StoreDatabase db) => db.CatalogProduct(id, true));
        admin.MapPost("/", async (CatalogEdit request, HttpContext context, StoreDatabase db) => Results.Ok(new { id = await db.SaveCatalogProduct(null, request, Actor(context)) }));
        admin.MapPut("/{id}", async (string id, CatalogEdit request, HttpContext context, StoreDatabase db) => Results.Ok(new { id = await db.SaveCatalogProduct(id, request, Actor(context)) }));
        admin.MapDelete("/{id}", async (string id, int version, HttpContext context, StoreDatabase db) => { await db.ArchiveProduct(id, version, Actor(context)); return Results.NoContent(); });
        admin.MapPost("/{id}/variants", async (string id, VariantEdit request, HttpContext context, StoreDatabase db) => Results.Ok(new { id = await db.SaveVariant(id, null, request, Actor(context)) }));
        admin.MapPut("/{id}/variants/{variantId}", async (string id, string variantId, VariantEdit request, HttpContext context, StoreDatabase db) => Results.Ok(new { id = await db.SaveVariant(id, variantId, request, Actor(context)) }));
        admin.MapGet("/stock/{id}/history", (string id, StoreDatabase db) => db.StockHistory(id));
        admin.MapPost("/categories", async (CategoryEdit request, HttpContext context, StoreDatabase db) => Results.Ok(new { id = await db.SaveCategory(null, request, Actor(context)) }));
        admin.MapPut("/categories/{id}", async (string id, CategoryEdit request, HttpContext context, StoreDatabase db) => Results.Ok(new { id = await db.SaveCategory(id, request, Actor(context)) }));
        return endpoints;
    }
    internal static string Actor(HttpContext context) => context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "legacy-admin";
}
