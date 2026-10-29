namespace Thesamenot.Api;

public sealed class ShippingSettings
{
    public string Country { get; set; } = "GR";
    public string Currency { get; set; } = "EUR";
    public string MethodName { get; set; } = "";
    public int CostCents { get; set; }
    public int? FreeFromCents { get; set; }
    public bool Enabled { get; set; }
    public int Version { get; set; }
}
public record QuoteRequest(List<CartLine> Items, string Country = "GR");
public sealed class CheckoutQuote
{
    public string Id { get; set; } = "";
    public string OwnerKey { get; set; } = "";
    public string CartHash { get; set; } = "";
    public string PriceHash { get; set; } = "";
    public string CommercialHash { get; set; } = "";
    public int ShippingVersion { get; set; }
    public int SubtotalCents { get; set; }
    public int ShippingCents { get; set; }
    public int TotalCents { get; set; }
    public DateTime ExpiresUtc { get; set; }
}
