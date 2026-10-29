namespace Thesamenot.Api;

public sealed class PaymentSettings
{
    public bool BankTransferEnabled { get; set; }
    public string AccountHolder { get; set; } = "";
    public string Iban { get; set; } = "";
    public string Bic { get; set; } = "";
    public int Version { get; set; }
}

public record PaymentSettingsUpdate(bool BankTransferEnabled, string AccountHolder, string Iban,
    string Bic, int Version, string ChallengeToken, string Code);
