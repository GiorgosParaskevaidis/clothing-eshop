using System.Text.Json;
namespace Thesamenot.Api.Services;

public static class LegalPolicies
{
    public record Policy(string Slug, string Title, string Body, string Version, bool Approved);
    private static readonly (string Slug, string Title, string Key, string Demo)[] Definitions = [
        ("terms","Terms","Terms","Seller details and final terms will be published before real sales open. This preview accepts test orders only."),
        ("privacy","Privacy","Privacy","Accounts, orders and newsletter consent are stored for the requested functions. The final privacy notice and retention policy have not been supplied."),
        ("returns","Returns","Returns","Final return instructions and merchant contact details have not been supplied. This preview records test return/withdrawal requests."),
        ("shipping","Shipping","ShippingPolicy","Final courier, dispatch times and shipping policy have not been supplied.")
    ];
    public static Policy[] All(IConfiguration configuration) => Definitions.Select(definition =>
    {
        var body = configuration["Merchant:" + definition.Key + "Body"];
        var version = configuration["Merchant:" + definition.Key + "Version"];
        var approved = configuration.GetValue<bool>("Merchant:PoliciesApproved") && !string.IsNullOrWhiteSpace(body) && !string.IsNullOrWhiteSpace(version);
        if ((body?.Length ?? 0) > 50000 || (version?.Length ?? 0) > 60) throw new InvalidOperationException("Policy bodies support up to 50,000 characters and versions up to 60 characters.");
        return new Policy(definition.Slug, definition.Title, approved ? body! : definition.Demo, approved ? version! : "demo-" + definition.Slug + "-v1", approved);
    }).ToArray();
    public static Policy Read(IConfiguration configuration, string slug) => All(configuration).SingleOrDefault(policy => policy.Slug == slug) ?? throw new StoreException(404, "Policy not found.");
    public static string Fingerprint(IConfiguration configuration, TaxCalculator.Profile tax) => StoreDatabase.SecretHash(JsonSerializer.Serialize(new { tax, policies = All(configuration) }));
}
