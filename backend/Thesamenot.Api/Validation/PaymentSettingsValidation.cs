using System.Text.RegularExpressions;

namespace Thesamenot.Api.Validation;

public static partial class PaymentSettingsValidation
{
    [GeneratedRegex("^[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$")]
    private static partial Regex BicPattern();

    public static PaymentSettings Normalize(PaymentSettingsUpdate request)
    {
        if (request.AccountHolder is null || request.Iban is null || request.Bic is null ||
            request.Version < 0 || request.AccountHolder.Length > 500 || request.Iban.Length > 64 || request.Bic.Length > 32)
            throw new StoreException(400, "Check the payment settings and their lengths.");
        var value = new PaymentSettings
        {
            BankTransferEnabled = request.BankTransferEnabled,
            AccountHolder = request.AccountHolder.Trim(),
            Iban = request.Iban.Trim().Replace(" ", "").ToUpperInvariant(),
            Bic = request.Bic.Trim().ToUpperInvariant(),
            Version = request.Version
        };
        if (value.AccountHolder.Length > 140 || value.AccountHolder.Any(char.IsControl))
            throw new StoreException(400, "Enter the account holder (up to 140 characters, without line breaks).");
        if (value.Iban.Length > 0 && !ManualPaymentMethods.ValidIban(value.Iban))
            throw new StoreException(400, "Enter a valid IBAN.");
        if (value.Bic.Length > 0 && !BicPattern().IsMatch(value.Bic))
            throw new StoreException(400, "Enter a valid BIC (8 or 11 characters), or leave it empty.");
        if (value.BankTransferEnabled && !ManualPaymentMethods.BankDetailsValid(value))
            throw new StoreException(400, "Enter the account holder and a valid IBAN before enabling bank transfer.");
        return value;
    }
}
