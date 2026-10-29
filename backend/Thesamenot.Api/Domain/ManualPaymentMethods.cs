using System.Text.Json;

namespace Thesamenot.Api;

public static class ManualPaymentMethods
{
    public const string BankTransfer = "BankTransfer";
    public const string CashOnDelivery = "CashOnDelivery";
    public static bool IsManual(string method) => method is BankTransfer or CashOnDelivery;

    public static bool BankDetailsValid(PaymentSettings value) =>
        !string.IsNullOrWhiteSpace(value.AccountHolder) && ValidIban(value.Iban);
    public static bool BankReady(PaymentSettings value) => value.BankTransferEnabled && BankDetailsValid(value);

    public static bool ValidIban(string? value)
    {
        var iban = value?.Replace(" ", "").ToUpperInvariant() ?? "";
        if (iban.Length is < 15 or > 34 || !iban[..2].All(char.IsAsciiLetterUpper) || !iban[2..4].All(char.IsAsciiDigit) ||
            !iban.All(char.IsAsciiLetterOrDigit)) return false;
        var remainder = 0;
        foreach (var character in iban[4..] + iban[..4])
        {
            var number = char.IsAsciiDigit(character) ? character - '0' : character - 'A' + 10;
            remainder = (remainder * (number >= 10 ? 100 : 10) + number) % 97;
        }
        return remainder == 1;
    }

    public static string Instructions(Order order, PaymentSettings? settings) => order.PaymentMode == BankTransfer
        ? "Bank transfer to Revolut\nAccount holder: " + settings!.AccountHolder +
          "\nIBAN: " + settings.Iban +
          (string.IsNullOrWhiteSpace(settings.Bic) ? "" : "\nBIC: " + settings.Bic) +
          "\nAmount: " + (order.TotalCents / 100m).ToString("0.00", System.Globalization.CultureInfo.InvariantCulture) + " EUR" +
          "\nPayment reference: " + order.OrderNumber + "\nDispatch follows confirmation of the deposit by the store."
        : "Cash on delivery. Pay the total to the courier when your order is delivered.\nAmount: " +
          (order.TotalCents / 100m).ToString("0.00", System.Globalization.CultureInfo.InvariantCulture) + " EUR";

    public static string? SnapshotInstructions(Order order) => order.PolicySnapshot is null ? null :
        JsonSerializer.Deserialize<Services.LegalPolicies.Policy[]>(order.PolicySnapshot)?.SingleOrDefault(policy => policy.Slug == "payment")?.Body;
}

public record ManualPaymentUpdate(int Version, int AmountCents, string Reference);
public record ManualOrderCancellation(int Version, string Reason);
