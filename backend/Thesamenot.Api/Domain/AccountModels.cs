namespace Thesamenot.Api;

public sealed class CustomerProfile
{
    public string Id { get; set; } = "";
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public int Version { get; set; }
}
public record ProfileUpdate(string DisplayName, int Version);
public record AddressUpdate(string Label, string Name, string Address, string City,
    string PostalCode, string Country, string Phone, bool IsDefault, int Version = 0);
public sealed class CustomerAddress
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string Name { get; set; } = "";
    public string Address { get; set; } = "";
    public string City { get; set; } = "";
    public string PostalCode { get; set; } = "";
    public string Country { get; set; } = "GR";
    public string Phone { get; set; } = "";
    public bool IsDefault { get; set; }
    public int Version { get; set; }
}
public record OrderLinkRequest(string Email, string OrderNumber, string Purpose);
public record PageResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);
public record CheckoutOwner(string Key, string? UserId, string? Email);
public sealed class OrderAccessGrant
{
    public string Id { get; set; } = "";
    public string OrderId { get; set; } = "";
}
public static class CustomerOrderView
{
    public static object Detail(Order order) => new
    {
        order.Id,
        number = order.OrderNumber,
        order.Status,
        order.PaymentMode,
        paymentInstructions = ManualPaymentMethods.SnapshotInstructions(order),
        order.PaymentStatus,
        order.FulfillmentStatus,
        order.Currency,
        order.Version,
        order.ShippingMethod,
        order.Email,
        order.Name,
        order.Address,
        order.City,
        order.PostalCode,
        order.Country,
        order.Phone,
        order.SubtotalCents,
        order.ShippingCents,
        order.TotalCents,
        order.CreatedUtc,
        order.Items,
        order.NetCents,
        order.TaxCents,
        order.TaxPolicyVersion,
        order.TermsVersion,
        order.ShippingPolicyVersion,
        order.PrivacyVersion,
        order.ReturnsPolicyVersion,
        policies = order.PolicySnapshot is null ? null : System.Text.Json.JsonSerializer.Deserialize<Services.LegalPolicies.Policy[]>(order.PolicySnapshot)
    };
}
