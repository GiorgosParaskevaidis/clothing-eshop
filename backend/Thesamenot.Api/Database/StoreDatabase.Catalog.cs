using System.Data;
using Dapper;
using MySqlConnector;
namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    private static async Task HydrateCatalog(MySqlConnection db, List<Product> products, bool admin)
    {
        if (products.Count == 0) return;
        var ids = products.Select(p => p.Id).ToArray();
        var variants = (await db.QueryAsync<Variant>("SELECT * FROM variants WHERE product_id IN @ids AND (active OR @admin) ORDER BY color,FIELD(size,'XS','S','M','L','XL','XXL'),size,id", new { ids, admin })).ToList();
        var images = (await db.QueryAsync<ProductImage>("SELECT * FROM product_images WHERE product_id IN @ids ORDER BY position,id", new { ids })).ToList();
        var categories = (await db.QueryAsync("SELECT pc.product_id,c.* FROM product_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.product_id IN @ids ORDER BY c.name,c.id", new { ids })).ToList();
        foreach (var product in products)
        {
            product.Variants = variants.Where(v => v.ProductId == product.Id).ToList();
            product.Images = images.Where(i => i.ProductId == product.Id).ToList();
            if (product.Images.Count > 0)
            {
                product.FrontImage = product.Images[0].Url;
                product.BackImage = product.Images.Count > 1 ? product.Images[1].Url : product.FrontImage;
            }
            product.Categories = categories.Where(c => (string)c.product_id == product.Id).Select(c => new Category { Id = c.id, Name = c.name, Slug = c.slug, Version = c.version }).ToList();
        }
    }
    public async Task<PageResult<Product>> Catalog(CatalogQuery query, bool admin = false)
    {
        Validation.AccountValidation.Pagination(query.Page, query.PageSize);
        if (query.PageSize > 48 || (query.Query?.Length ?? 0) > 120 || (query.Category?.Length ?? 0) > 120 ||
            (query.Size?.Length ?? 0) > 8 || (query.Color?.Length ?? 0) > 60 || query.MinPrice < 0 || query.MaxPrice < 0 ||
            query.MinPrice > query.MaxPrice) throw new StoreException(400, "Invalid catalog filters.");
        var order = query.Sort switch { "newest" => "p.created_utc DESC,p.id DESC", "price-asc" => "p.price_cents,p.id", "price-desc" => "p.price_cents DESC,p.id", "name" => "p.name,p.id", _ => throw new StoreException(400, "Unknown sort order.") };
        var args = new
        {
            admin,
            search = "%" + (query.Query ?? "").Trim().Replace("!", "!!").Replace("%", "!%").Replace("_", "!_") + "%",
            query.Category,
            query.Size,
            query.Color,
            query.InStock,
            query.MinPrice,
            query.MaxPrice,
            take = query.PageSize,
            offset = (query.Page - 1) * query.PageSize
        };
        const string filter = """
            FROM products p WHERE (@admin OR (p.active AND p.status='published'))
            AND (p.name LIKE @search ESCAPE '!' OR p.description LIKE @search ESCAPE '!')
            AND (@MinPrice IS NULL OR p.price_cents>=@MinPrice) AND (@MaxPrice IS NULL OR p.price_cents<=@MaxPrice)
            AND (@Category IS NULL OR EXISTS(SELECT 1 FROM product_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.product_id=p.id AND c.slug=@Category))
            AND ((@Size IS NULL AND @Color IS NULL AND NOT @InStock) OR EXISTS(
              SELECT 1 FROM variants v WHERE v.product_id=p.id AND v.active AND (@Size IS NULL OR v.size=@Size)
                AND (@Color IS NULL OR v.color=@Color) AND (NOT @InStock OR v.available>0)))
            """;
        await using var db = await Open();
        var total = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) " + filter, args);
        var products = (await db.QueryAsync<Product>("SELECT p.* " + filter + " ORDER BY " + order + " LIMIT @take OFFSET @offset", args)).ToList();
        await HydrateCatalog(db, products, admin);
        return new(products, query.Page, query.PageSize, total);
    }
    public async Task<Product> CatalogProduct(string slug, bool admin = false)
    {
        await using var db = await Open();
        var product = await db.QuerySingleOrDefaultAsync<Product>("SELECT * FROM products WHERE " + (admin ? "id" : "slug") + "=@slug AND (@admin OR (active AND status='published'))", new { slug, admin })
            ?? throw new StoreException(404, "Product not found.");
        await HydrateCatalog(db, [product], admin); return product;
    }
    public async Task<List<Product>> BasketProducts(string[] ids)
    {
        if (ids.Length > 8 || ids.Any(id => id.Length > 60)) throw new StoreException(400, "Invalid basket.");
        await using var db = await Open();
        var products = (await db.QueryAsync<Product>("SELECT DISTINCT p.* FROM products p JOIN variants v ON v.product_id=p.id WHERE v.id IN @ids AND p.active AND p.status='published'", new { ids })).ToList();
        await HydrateCatalog(db, products, false); return products;
    }
    public async Task<List<Category>> Categories()
    {
        await using var db = await Open(); return (await db.QueryAsync<Category>("SELECT * FROM categories ORDER BY name,id")).ToList();
    }
    public async Task<object> SitemapProducts(int page)
    {
        if (page is < 1 or > 100000) throw new StoreException(400, "Invalid sitemap page.");
        await using var db = await Open();
        return new
        {
            total = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM products WHERE active AND status='published'"),
            pageSize = 1000,
            items = await db.QueryAsync("SELECT slug,updated_utc updatedUtc FROM products WHERE active AND status='published' ORDER BY id LIMIT 1000 OFFSET @offset", new { offset = (page - 1) * 1000 })
        };
    }
    public async Task<string> SaveCategory(string? id, CategoryEdit value, string actor)
    {
        Validation.CatalogValidation.Slug(value.Slug);
        if (string.IsNullOrWhiteSpace(value.Name) || value.Name.Length > 120 || value.Version < 0) throw new StoreException(400, "Check the category fields.");
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        if (id is null) { id = Guid.NewGuid().ToString("N"); await db.ExecuteAsync("INSERT INTO categories(id,name,slug) VALUES(@id,@Name,@Slug)", new { id, value.Name, value.Slug }, tx); }
        else if (await db.ExecuteAsync("UPDATE categories SET name=@Name,slug=@Slug,version=version+1 WHERE id=@id AND version=@Version", new { id, value.Name, value.Slug, value.Version }, tx) != 1) throw new StoreException(409, "Category changed. Refresh.");
        await Audit(db, tx, actor, "category.saved", id); await tx.CommitAsync(); return id;
    }
    public async Task<string> SaveCatalogProduct(string? id, CatalogEdit value, string actor)
    {
        Validation.CatalogValidation.Edit(value);
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        Product? previous = null;
        if (id is not null)
        {
            previous = await db.QuerySingleOrDefaultAsync<Product>("SELECT * FROM products WHERE id=@id FOR UPDATE", new { id }, tx) ?? throw new StoreException(404, "Product not found.");
            if (previous.Version != value.Version) throw new StoreException(409, "Product changed. Refresh before saving.");
            if (value.InventoryMode != previous.InventoryMode && await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM order_items i JOIN variants v ON v.id=i.variant_id WHERE v.product_id=@id", new { id }, tx) > 0)
                throw new StoreException(409, "Inventory mode cannot change after an order has referenced this product.");
        }
        else
        {
            if (value.Status != "draft") throw new StoreException(400, "Create a draft before publishing.");
            id = Guid.NewGuid().ToString("N");
            await db.ExecuteAsync("INSERT INTO products(id,name,description,price_cents,edition,front_image,back_image,active,slug) VALUES(@id,@Name,@Description,@PriceCents,@Edition,'','',FALSE,@Slug)", new { id, value.Name, value.Description, value.PriceCents, value.Edition, value.Slug }, tx);
        }
        if (value.InventoryMode == "limited")
        {
            var units = await db.ExecuteScalarAsync<long>("""
                SELECT (SELECT COALESCE(SUM(available),0) FROM variants WHERE product_id=@id) +
                  (SELECT COALESCE(SUM(i.quantity-COALESCE((SELECT SUM(ri.restocked_quantity) FROM return_items ri WHERE ri.order_item_id=i.id),0)),0) FROM order_items i JOIN variants v ON v.id=i.variant_id JOIN orders o ON o.id=i.order_id WHERE v.product_id=@id AND o.status IN ('pending','awaiting_payment','confirmed','paid','fulfilled'))
                """, new { id }, tx);
            if (units > value.Edition) throw new StoreException(409, "Edition cannot be below available, reserved and sold units.");
        }
        if (value.Status == "published")
        {
            if (await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM variants WHERE product_id=@id AND active", new { id }, tx) == 0 ||
               await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM product_images WHERE product_id=@id", new { id }, tx) == 0)
                throw new StoreException(400, "Publishing requires an active SKU and at least one uploaded image.");
        }
        await db.ExecuteAsync("""
            UPDATE products SET name=@Name,slug=@Slug,description=@Description,price_cents=@PriceCents,edition=@Edition,
              inventory_mode=@InventoryMode,material=@Material,care=@Care,size_guide=@SizeGuide,status=@Status,active=(@Status='published'),
              version=version+1,updated_utc=UTC_TIMESTAMP(6) WHERE id=@id
            """, new { id, value.Name, value.Slug, value.Description, value.PriceCents, value.Edition, value.InventoryMode, value.Material, value.Care, value.SizeGuide, value.Status }, tx);
        await db.ExecuteAsync("DELETE FROM product_categories WHERE product_id=@id", new { id }, tx);
        foreach (var categoryId in value.CategoryIds.Distinct())
        {
            if (await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM categories WHERE id=@categoryId", new { categoryId }, tx) != 1) throw new StoreException(400, "Unknown category.");
            await db.ExecuteAsync("INSERT INTO product_categories VALUES(@id,@categoryId)", new { id, categoryId }, tx);
        }
        await Audit(db, tx, actor, "product." + value.Status, id); await tx.CommitAsync(); return id;
    }
    public async Task ArchiveProduct(string id, int version, string actor)
    {
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        if (await db.ExecuteAsync("UPDATE products SET status='archived',active=FALSE,version=version+1,updated_utc=UTC_TIMESTAMP(6) WHERE id=@id AND version=@version", new { id, version }, tx) != 1) throw new StoreException(409, "Product changed. Refresh.");
        await Audit(db, tx, actor, "product.archived", id); await tx.CommitAsync();
    }
    public async Task<string> SaveVariant(string productId, string? id, VariantEdit value, string actor)
    {
        Validation.CatalogValidation.Variant(value);
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        var product = await db.QuerySingleOrDefaultAsync<Product>("SELECT * FROM products WHERE id=@productId FOR UPDATE", new { productId }, tx) ?? throw new StoreException(404, "Product not found.");
        if (id is null)
        {
            id = Guid.NewGuid().ToString("N");
            await db.ExecuteAsync("INSERT INTO variants(id,product_id,size,available,sku,color,active) VALUES(@id,@productId,@Size,0,@Sku,@Color,@Active)", new { id, productId, value.Size, value.Sku, value.Color, value.Active }, tx);
        }
        else
        {
            var old = await db.QuerySingleOrDefaultAsync<Variant>("SELECT * FROM variants WHERE id=@id AND product_id=@productId FOR UPDATE", new { id, productId }, tx) ?? throw new StoreException(404, "Variant not found.");
            if (old.Version != value.Version) throw new StoreException(409, "Variant changed. Refresh.");
            if ((old.Size != value.Size || old.Color != value.Color || old.Sku != value.Sku) &&
                await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM order_items WHERE variant_id=@id", new { id }, tx) > 0)
                throw new StoreException(409, "An ordered SKU is immutable. Deactivate it and add a new SKU.");
            if (!value.Active && product.Status == "published" && await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM variants WHERE product_id=@productId AND active AND id<>@id", new { id, productId }, tx) == 0)
                throw new StoreException(409, "Archive the product before deactivating its last SKU.");
            await db.ExecuteAsync("UPDATE variants SET sku=@Sku,size=@Size,color=@Color,active=@Active,version=version+1 WHERE id=@id", new { id, value.Sku, value.Size, value.Color, value.Active }, tx);
        }
        await db.ExecuteAsync("UPDATE products SET version=version+1,updated_utc=UTC_TIMESTAMP(6) WHERE id=@productId", new { productId }, tx);
        await Audit(db, tx, actor, "variant.saved", id); await tx.CommitAsync(); return id;
    }
    public async Task<object> StockHistory(string id)
    {
        await using var db = await Open();
        return await db.QueryAsync("SELECT id,delta,reason,actor,created_utc createdUtc FROM inventory_movements WHERE variant_id=@id ORDER BY id DESC LIMIT 100", new { id });
    }
}
