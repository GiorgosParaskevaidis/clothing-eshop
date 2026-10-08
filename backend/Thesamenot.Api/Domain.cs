namespace Thesamenot.Api;

public sealed class Product {
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
public sealed class Variant {
    public string Id { get; set; } = "";
    public string ProductId { get; set; } = "";
    public string Size { get; set; } = "";
    public int Available { get; set; }
    public int Version { get; set; }
}
public sealed class Order {
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
public sealed class OrderItem {
    public string VariantId { get; set; } = "";
    public string ProductName { get; set; } = "";
    public string Size { get; set; } = "";
    public int Quantity { get; set; }
    public int UnitPriceCents { get; set; }
}
public record CartLine(string VariantId, int Quantity);
public record CheckoutRequest(string RequestKey, string Email, string Name, string Address, string City, string PostalCode, string Country, bool AcceptTerms, List<CartLine> Items);
public record NewsletterRequest(string Email, bool Consent);
public record LoginRequest(string Email, string Password);
public record ProductUpdate(string Name, string Description, int PriceCents, bool Active);
public record StockUpdate(int Available, int Version);
public sealed class StoreException(int status, string message) : Exception(message) { public int Status { get; } = status; }
public sealed class StoreOptions {
    public string PublicUrl { get; set; } = "http://localhost:3000";
    public DateTimeOffset DropOpensAt { get; set; } = DateTimeOffset.Parse("2026-11-14T20:00:00+02:00");
    public bool SalesEnabled { get; set; }
    public int ShippingCents { get; set; } = 400;
    public int FreeShippingThresholdCents { get; set; } = 8000;
    public string InstagramUrl { get; set; } = "";
    public string ContactEmail { get; set; } = "";
    public string PaymentMode { get; set; } = "Stripe";
}
