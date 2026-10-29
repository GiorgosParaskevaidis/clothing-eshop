using Thesamenot.Api.Endpoints;
using Thesamenot.Api.Hosting;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true).AddEnvironmentVariables();
builder.Services.AddStoreBackend(builder.Configuration, builder.Environment);

var app = builder.Build();
app.UseStorePipeline();

app.MapStoreEndpoints();
app.MapNewsletterEndpoints();
app.MapCheckoutEndpoints();
app.MapPaymentEndpoints(app.Environment);
app.MapAdminEndpoints();
app.MapAuthEndpoints();
app.MapAccountEndpoints();
app.MapOrderAccessEndpoints();
app.MapCustomerAdminEndpoints();
app.MapCatalogEndpoints();
app.MapMediaEndpoints();
app.MapShippingEndpoints();
app.MapPaymentSettingsEndpoints();
app.MapOperationsEndpoints();
app.MapPolicyEndpoints();

await app.InitializeStoreDatabaseAsync();
app.Run();
