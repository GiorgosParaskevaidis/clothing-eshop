using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Thesamenot.Api.Services;
internal static class TaxContractChecks
{
    public static void Run()
    {
        var profile = new TaxCalculator.Profile("InclusiveSingleRate", "fixture-v1", 2000, true);
        foreach (var (gross, net, tax) in new[] { (12000, 10000, 2000), (0, 0, 0), (3, 2, 1), (1, 1, 0) })
        {
            var result = TaxCalculator.Calculate(gross, profile);
            if (result.NetCents != net || result.TaxCents != tax || result.NetCents + result.TaxCents != gross)
                throw new InvalidOperationException("Inclusive tax arithmetic contract failed.");
            using var json = JsonDocument.Parse(result.Snapshot);
            if (json.RootElement.GetProperty("Version").GetString() != "fixture-v1") throw new InvalidOperationException("Tax policy snapshot failed.");
        }
        var unconfigured = TaxCalculator.Read(new ConfigurationBuilder().Build());
        var missing = TaxCalculator.Calculate(12000, unconfigured);
        if (missing.NetCents is not null || missing.TaxCents is not null) throw new InvalidOperationException("Unapproved tax treatment must not invent a tax amount.");
        var zero = TaxCalculator.Calculate(12345, new("InclusiveSingleRate", "fixture-zero", 0, true));
        if (zero.TaxCents != 0 || zero.NetCents != 12345) throw new InvalidOperationException("Zero-rate arithmetic failed.");
        try { TaxCalculator.Calculate(100, new("InclusiveSingleRate", "bad", -1, true)); throw new Exception("Invalid rate accepted."); }
        catch (InvalidOperationException) { }
        Console.WriteLine("Seven tax contracts passed: inclusive arithmetic/rounding, zero rate, policy snapshot and unconfigured/invalid profiles.");
    }
}
