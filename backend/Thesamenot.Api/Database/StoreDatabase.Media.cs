using Dapper;
namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    public async Task AddProductImage(string id, string key, string alt, int position, int width, int height, int version, string actor)
    {
        if (string.IsNullOrWhiteSpace(alt) || alt.Length > 200 || position is < 0 or > 20) throw new StoreException(400, "Image alt text and position 0–20 are required.");
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        var current = await db.ExecuteScalarAsync<int?>("SELECT version FROM products WHERE id=@id FOR UPDATE", new { id }, tx);
        if (current != version) throw new StoreException(409, "Product changed. Refresh.");
        if (await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM product_images WHERE product_id=@id", new { id }, tx) >= 12) throw new StoreException(400, "Maximum 12 images per product.");
        await db.ExecuteAsync("INSERT INTO product_images(id,product_id,storage_key,alt_text,position,width,height) VALUES(@imageId,@id,@key,@alt,@position,@width,@height)", new { imageId = Guid.NewGuid().ToString("N"), id, key, alt, position, width, height }, tx);
        await db.ExecuteAsync("UPDATE products SET version=version+1,updated_utc=UTC_TIMESTAMP(6) WHERE id=@id", new { id }, tx);
        await Audit(db, tx, actor, "product.image-added", id); await tx.CommitAsync();
    }
    public async Task<bool> MediaVisible(string key, bool admin)
    {
        await using var db = await Open();
        return await db.ExecuteScalarAsync<bool>("SELECT EXISTS(SELECT 1 FROM product_images i JOIN products p ON p.id=i.product_id WHERE i.storage_key=@key AND (@admin OR (p.status='published' AND p.active))) OR EXISTS(SELECT 1 FROM order_items WHERE image_url=CONCAT('/api/media/',@key))", new { key, admin });
    }
    public async Task EditProductImage(string productId, string id, ProductImageEdit request, string actor, bool remove = false)
    {
        if (string.IsNullOrWhiteSpace(request.AltText) || request.AltText.Length > 200 || request.Position is < 0 or > 20)
            throw new StoreException(400, "Image description and position are required.");
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        var product = await db.QuerySingleOrDefaultAsync<Product>("SELECT * FROM products WHERE id=@productId FOR UPDATE", new { productId }, tx) ?? throw new StoreException(404, "Product not found.");
        if (product.Version != request.Version) throw new StoreException(409, "Product changed. Refresh.");
        if (remove && product.Status == "published" && await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM product_images WHERE product_id=@productId", new { productId }, tx) <= 1)
            throw new StoreException(409, "A published product needs at least one image.");
        var changed = remove
            ? await db.ExecuteAsync("DELETE FROM product_images WHERE id=@id AND product_id=@productId", new { id, productId }, tx)
            : await db.ExecuteAsync("UPDATE product_images SET alt_text=@AltText,position=@Position WHERE id=@id AND product_id=@productId", new { id, productId, request.AltText, request.Position }, tx);
        if (changed != 1) throw new StoreException(404, "Image not found.");
        await db.ExecuteAsync("UPDATE products SET version=version+1,updated_utc=UTC_TIMESTAMP(6) WHERE id=@productId", new { productId }, tx);
        await Audit(db, tx, actor, remove ? "product.image-detached" : "product.image-edited", productId); await tx.CommitAsync();
        // Storage bytes are retained for order snapshots. Retention/garbage collection requires the merchant's policy.
    }
    // Image bytes are retained when archived: historical records must never depend on deleting a product's assets.
}
