namespace Thesamenot.Api;

public sealed class Product
{
    public string Slug { get; set; } = "";
    public string Status { get; set; } = "draft";
    public string Currency { get; set; } = "EUR";
    public string Material { get; set; } = "";
    public string Care { get; set; } = "";
    public string SizeGuide { get; set; } = "";
    public string InventoryMode { get; set; } = "limited";
    public int Version { get; set; }
    public List<Category> Categories { get; set; } = [];
    public List<ProductImage> Images { get; set; } = [];
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public int PriceCents { get; set; }
    public int Edition { get; set; }
    public string FrontImage { get; set; } = "";
    public string BackImage { get; set; } = "";
    public bool Active { get; set; }
    public List<Variant> Variants { get; set; } = [];
}
public sealed class Variant
{
    public string Sku { get; set; } = "";
    public string Color { get; set; } = "";
    public bool Active { get; set; } = true;
    public string Id { get; set; } = "";
    public string ProductId { get; set; } = "";
    public string Size { get; set; } = "";
    public int Available { get; set; }
    public int Version { get; set; }
}
public sealed class Order
{
    public string? PolicySnapshot { get; set; }
    public int? NetCents { get; set; }
    public int? TaxCents { get; set; }
    public string TaxPolicyVersion { get; set; } = "demo-unconfigured";
    public string? TaxSnapshot { get; set; }
    public string ShippingPolicyVersion { get; set; } = "";
    public string PrivacyVersion { get; set; } = "";
    public string ReturnsPolicyVersion { get; set; } = "";
    public string PaymentStatus { get; set; } = "pending";
    public string ReservationStatus { get; set; } = "active";
    public string FulfillmentStatus { get; set; } = "unfulfilled";
    public string? StripePaymentIntent { get; set; }
    public string Currency { get; set; } = "EUR";
    public string ShippingMethod { get; set; } = "";
    public int ShippingVersion { get; set; }
    public string? QuoteId { get; set; }
    public string TermsVersion { get; set; } = "";
    public string? UserId { get; set; }
    public string CheckoutOwner { get; set; } = "";
    public string OrderNumber { get; set; } = "";
    public string Phone { get; set; } = "";
    public int Version { get; set; }
    public string Id { get; set; } = "";
    public string PublicToken { get; set; } = "";
    public string RequestKey { get; set; } = "";
    public string PayloadHash { get; set; } = "";
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public string Address { get; set; } = "";
    public string City { get; set; } = "";
    public string PostalCode { get; set; } = "";
    public string Country { get; set; } = "GR";
    public string Status { get; set; } = "pending";
    public string PaymentMode { get; set; } = "";
    public string? StripeSessionId { get; set; }
    public string? CheckoutUrl { get; set; }
    public int SubtotalCents { get; set; }
    public int ShippingCents { get; set; }
    public int TotalCents { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public List<OrderItem> Items { get; set; } = [];
}
public sealed class OrderItem
{
    public string ProductSlug { get; set; } = "";
    public string Sku { get; set; } = "";
    public string Color { get; set; } = "";
    public string ImageUrl { get; set; } = "";
    public long Id { get; set; }
    public string VariantId { get; set; } = "";
    public string ProductName { get; set; } = "";
    public string Size { get; set; } = "";
    public int Quantity { get; set; }
    public int UnitPriceCents { get; set; }
}
public record CartLine(string VariantId, int Quantity);
public record CheckoutRequest(string RequestKey, string Email, string Name, string Address, string City, string PostalCode, string Country, bool AcceptTerms, List<CartLine> Items, string Phone = "", string? QuoteId = null, string PaymentMethod = "");
public record NewsletterRequest(string Email, bool Consent);
public record UnsubscribeRequest(string Token);
public record LoginRequest(string Email, string Password);
public record ProductUpdate(string Name, string Description, int PriceCents, bool Active, int? Version = null);
public record StockUpdate(int Available, int Version, string Reason = "Manual stock adjustment");
public sealed class StoreException(int status, string message, int? retryAfterSeconds = null) : Exception(message) { public int Status { get; } = status; public int? RetryAfterSeconds { get; } = retryAfterSeconds; }
public sealed class StoreOptions
{
    public string PublicUrl { get; set; } = "http://localhost:3000";
    public DateTimeOffset DropOpensAt { get; set; } = DateTimeOffset.Parse("2026-11-14T20:00:00+02:00");
    public bool SalesEnabled { get; set; }
    public int ShippingCents { get; set; } = 400;
    public int FreeShippingThresholdCents { get; set; } = 8000;
    public string InstagramUrl { get; set; } = "";
    public string ContactEmail { get; set; } = "";
    public string PaymentMode { get; set; } = "Manual";
}
