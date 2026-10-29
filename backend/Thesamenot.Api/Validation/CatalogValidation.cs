using System.Text.RegularExpressions;
namespace Thesamenot.Api.Validation;

public static partial class CatalogValidation
{
    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")] private static partial Regex SlugPattern();
    public static void Slug(string value)
    {
        if (value is null || value.Length > 120 || !SlugPattern().IsMatch(value)) throw new StoreException(400, "Use a unique lowercase slug with letters, numbers and hyphens.");
    }
    public static void Edit(CatalogEdit value)
    {
        Slug(value.Slug);
        if (string.IsNullOrWhiteSpace(value.Name) || value.Name.Length > 120 || value.Description is null || value.Description.Length > 1000 ||
            value.PriceCents is < 1 or > 10000000 || value.Edition is < 1 or > 1000000 || value.Version < 0 ||
            value.InventoryMode is not ("limited" or "replenishable") || value.Status is not ("draft" or "published" or "archived") ||
            value.Material is null || value.Material.Length > 1000 || value.Care is null || value.Care.Length > 1000 ||
            value.SizeGuide is null || value.SizeGuide.Length > 2000 || value.CategoryIds is null || value.CategoryIds.Length > 20 ||
            value.CategoryIds.Any(id => id is null || id.Length != 32)) throw new StoreException(400, "Check the product fields.");
        if (value.Status == "published" && new[] { value.Description, value.Material, value.Care, value.SizeGuide }.Any(string.IsNullOrWhiteSpace))
            throw new StoreException(400, "Publishing requires description, material, care and a size guide.");
    }
    public static void Variant(VariantEdit value)
    {
        if (string.IsNullOrWhiteSpace(value.Sku) || value.Sku.Length > 80 || value.Sku.Any(char.IsControl) ||
            string.IsNullOrWhiteSpace(value.Size) || value.Size.Length > 8 || string.IsNullOrWhiteSpace(value.Color) || value.Color.Length > 60 || value.Version < 0)
            throw new StoreException(400, "A unique SKU, size and color are required.");
    }
}
