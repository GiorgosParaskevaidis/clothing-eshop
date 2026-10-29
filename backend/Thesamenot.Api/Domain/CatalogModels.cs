namespace Thesamenot.Api;

public record CatalogQuery(int Page = 1, int PageSize = 24, string? Query = null, string? Category = null,
    string? Size = null, string? Color = null, int? MinPrice = null, int? MaxPrice = null, bool InStock = false, string Sort = "newest");
public record CatalogEdit(string Name, string Slug, string Description, int PriceCents, int Edition,
    string InventoryMode, string Material, string Care, string SizeGuide, string Status, int Version, string[] CategoryIds);
public record VariantEdit(string Sku, string Size, string Color, bool Active, int Version);
public record CategoryEdit(string Name, string Slug, int Version = 0);
public record ProductImageEdit(string AltText, int Position, int Version);
public sealed class Category
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public int Version { get; set; }
}
public sealed class ProductImage
{
    public string Id { get; set; } = "";
    public string ProductId { get; set; } = "";
    public string StorageKey { get; set; } = "";
    public string AltText { get; set; } = "";
    public int Position { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public string Url => "/api/media/" + StorageKey;
}
