namespace Thesamenot.Api.Hosting;

public static class ProductionReadiness
{
    public static string[] Missing(IConfiguration configuration)
    {
        var missing = new List<string>();
        foreach (var key in new[] { "BusinessName", "TaxIdentity", "PostalAddress", "SupportEmail", "TermsVersion", "PrivacyVersion", "ReturnsVersion", "ShippingPolicyVersion", "Courier", "InvoicingProvider", "RetentionPolicy", "RecoveryTargets" })
            if (string.IsNullOrWhiteSpace(configuration["Merchant:" + key])) missing.Add("Merchant:" + key);
        foreach (var key in new[] { "PoliciesApproved", "TaxProfileApproved", "ManualPaymentsVerified", "SenderDomainVerified", "PersistentStorageVerified", "ProductionRestoreVerified", "ProxyVerified", "ReleaseApproved" })
            if (!configuration.GetValue<bool>("Merchant:" + key)) missing.Add("Merchant:" + key);
        if (configuration["Media:Mode"] != "S3") missing.Add("Media:PersistentS3");
        if (Services.TaxCalculator.Read(configuration).Mode == "Unconfigured") missing.Add("Merchant:TaxPolicyVersion");
        foreach (var policy in Services.LegalPolicies.All(configuration)) if (!policy.Approved) missing.Add("Merchant:ApprovedPolicy:" + policy.Slug);
        return missing.ToArray();
    }
    public static async Task Validate(WebApplication app)
    {
        if (app.Environment.IsProduction() && app.Services.GetRequiredService<StoreOptions>().SalesEnabled)
        {
            var payments = await app.Services.GetRequiredService<StoreDatabase>().PaymentSettings();
            if (payments.BankTransferEnabled && !ManualPaymentMethods.BankReady(payments))
                throw new InvalidOperationException("Enabled bank transfer requires valid details in admin payment settings.");
            if (Missing(app.Configuration).Length > 0)
                throw new InvalidOperationException("Production sales require the completed merchant/provider/release checklist. See TODO-PRODUCTION.md.");
            if (await app.Services.GetRequiredService<StoreDatabase>().IncompletePublishedProducts() > 0)
                throw new InvalidOperationException("Complete the published catalog content, SKU and images before enabling production sales.");
        }
    }
}
