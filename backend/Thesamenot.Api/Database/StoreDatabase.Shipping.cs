using System.Text.Json;
using Dapper;
namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    public async Task<ShippingSettings> Shipping()
    {
        await using var db = await Open(); return await db.QuerySingleAsync<ShippingSettings>("SELECT * FROM shipping_settings WHERE id=1");
    }
    public async Task SaveShipping(ShippingSettings value, string actor)
    {
        if (value.Country != "GR" || value.Currency != "EUR" || string.IsNullOrWhiteSpace(value.MethodName) || value.MethodName.Length > 120 ||
            value.CostCents is < 0 or > 100000 || value.FreeFromCents is < 0 or > 10000000 || value.Version < 0)
            throw new StoreException(400, "Check the shipping method and amounts. This release supports Greece and EUR.");
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        if (await db.ExecuteAsync("""
            UPDATE shipping_settings SET method_name=@MethodName,cost_cents=@CostCents,free_from_cents=@FreeFromCents,
              enabled=@Enabled,version=version+1,updated_utc=UTC_TIMESTAMP(6) WHERE id=1 AND version=@Version
            """, value, tx) != 1) throw new StoreException(409, "Shipping settings changed. Refresh.");
        await Audit(db, tx, actor, "shipping.updated", "1"); await tx.CommitAsync();
    }
    private static string CartHash(IEnumerable<CartLine> items, string country) => SecretHash(JsonSerializer.Serialize(new { country, items = items.OrderBy(i => i.VariantId, StringComparer.Ordinal) }));
    private sealed class QuoteLine
    {
        public string Id { get; set; } = "";
        public int PriceCents { get; set; }
        public int Version { get; set; }
        public int Available { get; set; }
    }
    private static string PriceHash(IEnumerable<QuoteLine> lines) => SecretHash(JsonSerializer.Serialize(lines.OrderBy(l => l.Id, StringComparer.Ordinal).Select(l => new { l.Id, l.PriceCents, l.Version })));
    public async Task<object> CreateQuote(QuoteRequest request, CheckoutOwner owner)
    {
        if (request.Country != "GR" || request.Items is not { Count: >= 1 and <= 8 } ||
            request.Items.Any(i => string.IsNullOrWhiteSpace(i.VariantId) || i.VariantId.Length > 60 || i.Quantity is < 1 or > 10) ||
            request.Items.Select(i => i.VariantId).Distinct().Count() != request.Items.Count)
            throw new StoreException(400, "Check the basket and shipping country.");
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        var shipping = await db.QuerySingleAsync<ShippingSettings>("SELECT * FROM shipping_settings WHERE id=1 LOCK IN SHARE MODE", transaction: tx);
        if (!shipping.Enabled) throw new StoreException(409, "Shipping is temporarily unavailable.");
        var lines = (await db.QueryAsync<QuoteLine>("""
            SELECT v.id,p.price_cents,p.version,v.available FROM products p JOIN variants v ON v.product_id=p.id
            WHERE v.id IN @ids AND v.active AND p.active AND p.status='published' ORDER BY p.id,v.id LOCK IN SHARE MODE
            """, new { ids = request.Items.Select(i => i.VariantId).ToArray() }, tx)).ToList();
        if (lines.Count != request.Items.Count || request.Items.Any(i => lines.Single(l => l.Id == i.VariantId).Available < i.Quantity))
            throw new StoreException(409, "Some pieces are no longer available. Review your basket.");
        var subtotal = request.Items.Sum(i => checked(lines.Single(l => l.Id == i.VariantId).PriceCents * i.Quantity));
        var quote = new CheckoutQuote
        {
            Id = Guid.NewGuid().ToString("N"),
            OwnerKey = owner.Key,
            CartHash = CartHash(request.Items, request.Country),
            PriceHash = PriceHash(lines),
            ShippingVersion = shipping.Version,
            SubtotalCents = subtotal,
            ShippingCents = shipping.FreeFromCents.HasValue && subtotal >= shipping.FreeFromCents ? 0 : shipping.CostCents,
            ExpiresUtc = DateTime.UtcNow.AddMinutes(10)
        };
        quote.TotalCents = checked(subtotal + quote.ShippingCents);
        var profile = Services.TaxCalculator.Read(configuration);
        var tax = Services.TaxCalculator.Calculate(quote.TotalCents, profile);
        quote.CommercialHash = Services.LegalPolicies.Fingerprint(configuration, profile);
        await db.ExecuteAsync("""
            INSERT INTO checkout_quotes(id,owner_key,cart_hash,price_hash,shipping_version,subtotal_cents,shipping_cents,total_cents,created_utc,expires_utc,commercial_hash)
            VALUES(@Id,@OwnerKey,@CartHash,@PriceHash,@ShippingVersion,@SubtotalCents,@ShippingCents,@TotalCents,UTC_TIMESTAMP(6),@ExpiresUtc,@CommercialHash)
            """, quote, tx);
        await tx.CommitAsync();
        return new { quote.Id, quote.SubtotalCents, quote.ShippingCents, quote.TotalCents, quote.ExpiresUtc, shipping.Currency, shipping.MethodName, shipping.Version, tax.NetCents, tax.TaxCents, taxPolicyVersion = profile.Version };
    }
}
