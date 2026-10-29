using System.Text.Json;
namespace Thesamenot.Api.Services;
// This release supports one explicitly approved inclusive rate for goods and shipping.
// A merchant requiring exemptions/mixed rates must supply a different approved tax profile before launch.
public static class TaxCalculator
{
    public record Profile(string Mode, string Version, int? RateBasisPoints, bool Approved);
    public record Amounts(int? NetCents, int? TaxCents, string Snapshot);
    public static Profile Read(IConfiguration configuration)
    {
        if (!configuration.GetValue<bool>("Merchant:TaxProfileApproved")) return new("Unconfigured", "demo-unconfigured", null, false);
        var rate = configuration.GetValue<int?>("Merchant:TaxRateBasisPoints");
        var version = configuration["Merchant:TaxPolicyVersion"];
        if (configuration["Merchant:TaxCalculationMode"] != "InclusiveSingleRate" || rate is null or < 0 or > 5000 || string.IsNullOrWhiteSpace(version) || version.Length > 60)
            throw new InvalidOperationException("The approved tax profile requires InclusiveSingleRate, a 0–5000 basis-point rate and a policy version.");
        return new("InclusiveSingleRate", version, rate, true);
    }
    public static string Fingerprint(Profile profile) => StoreDatabase.SecretHash(JsonSerializer.Serialize(profile));
    public static Amounts Calculate(int grossCents, Profile profile)
    {
        if (grossCents < 0) throw new ArgumentOutOfRangeException(nameof(grossCents));
        if (!profile.Approved) return new(null, null, JsonSerializer.Serialize(profile));
        if (profile.RateBasisPoints is null or < 0 or > 5000 || profile.Mode != "InclusiveSingleRate") throw new InvalidOperationException("Unsupported tax profile.");
        var tax = checked((int)decimal.Round(grossCents * (decimal)profile.RateBasisPoints.Value / (10000 + profile.RateBasisPoints.Value), 0, MidpointRounding.AwayFromZero));
        return new(grossCents - tax, tax, JsonSerializer.Serialize(new { profile.Mode, profile.Version, profile.RateBasisPoints, includesShipping = true, rounding = "order-total-away-from-zero" }));
    }
}
