using System.ComponentModel.DataAnnotations;

namespace Thesamenot.Api.Validation;

internal static class RequestValidation
{
    public static void ValidateNewsletter(NewsletterRequest request)
    {
        if (!IsValidEmail(request.Email) || !request.Consent)
        {
            throw new StoreException(400, "Enter a valid email and agree to receive drop updates.");
        }
    }

    public static void ValidateCheckout(CheckoutRequest request)
    {
        var validContact = IsValidEmail(request.Email) && HasText(request.Name, 120);
        var validAddress = request.Country == "GR" &&
            HasText(request.Address, 250) && HasText(request.City, 120) && HasText(request.PostalCode, 24);
        var validItems = request.Items is { Count: >= 1 and <= 8 } &&
            request.Items.All(item => HasText(item.VariantId, 60) && item.Quantity is >= 1 and <= 10) &&
            request.Items.Select(item => item.VariantId).Distinct().Count() == request.Items.Count;

        if (!Guid.TryParse(request.RequestKey, out _) || !request.AcceptTerms ||
            !validContact || !validAddress || !validItems)
        {
            throw new StoreException(400, "Check your contact details, shipping address, terms and basket quantities.");
        }
    }

    public static void ValidateProduct(ProductUpdate request)
    {
        if (!HasText(request.Name, 120) || !HasText(request.Description, 1000) ||
            request.PriceCents is < 1 or > 1_000_000)
        {
            throw new StoreException(400, "Enter a name, description and valid price.");
        }
    }

    public static void ValidateStock(StockUpdate request)
    {
        if (request.Available is < 0 or > 100000 || request.Version < 0)
        {
            throw new StoreException(400, "Invalid stock quantity.");
        }
    }

    private static bool HasText(string? value, int maxLength) =>
        !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= maxLength;

    private static bool IsValidEmail(string? value) =>
        value is { Length: <= 254 } && new EmailAddressAttribute().IsValid(value);
}
