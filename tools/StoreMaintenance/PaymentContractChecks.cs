using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using MySqlConnector;
using Stripe;
using Thesamenot.Api;

internal static class PaymentContractChecks
{
    private static void Check(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
    public static async Task Run(IConfiguration fixture)
    {
        var connection = new MySqlConnectionStringBuilder(fixture.GetConnectionString("Store") ?? "");
        if (connection.Server != "127.0.0.1" || connection.Port != 13307 || !Regex.IsMatch(connection.Database, "^phase1_[a-f0-9]{12}_test$"))
            throw new InvalidOperationException("Payment contract checks require the isolated phase1 fixture, never the personal or online store.");
        var config = new ConfigurationBuilder().AddConfiguration(fixture).AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Store:PaymentMode"] = "Stripe",
            ["Stripe:SecretKey"] = "sk_test_fixture"
        }).Build();
        var protection = DataProtectionProvider.Create(new DirectoryInfo(config["Auth:KeyRingPath"]!), builder =>
        {
            builder.SetApplicationName("thesamenot"); if (OperatingSystem.IsWindows()) builder.ProtectKeysWithDpapi();
        });
        var database = new StoreDatabase(config, protection);
        await using var db = await database.Open();
        using var transport = new ProviderTransport();
        using var http = new HttpClient(transport);
        var client = new StripeClient(new StripeClientOptions { ApiKey = "sk_test_fixture", HttpClient = new SystemNetHttpClient(http, maxNetworkRetries: 0, enableTelemetry: false) });
        var options = config.GetSection("Store").Get<StoreOptions>()!;
        var owner = new CheckoutOwner("contract:" + Guid.NewGuid().ToString("N"), null, null);
        var ids = new List<string>();
        Payments Service() => new(new StoreDatabase(config, protection), config, options, new FixtureEnvironment(), client);
        async Task<CheckoutRequest> Request()
        {
            var items = new List<CartLine> { new("hood-M", 1) };
            var quote = JsonSerializer.SerializeToElement(await database.CreateQuote(new(items), owner));
            return new(Guid.NewGuid().ToString(), "payment-contract@phase1.example", "Fixture", "Fixture street", "Athens", "10563", "GR", true, items, QuoteId: quote.GetProperty("Id").GetString());
        }
        async Task<Thesamenot.Api.Order> OrderFor(CheckoutRequest request)
        {
            var order = await database.Find(request.RequestKey, owner) ?? throw new InvalidOperationException("Fixture reservation missing.");
            if (!ids.Contains(order.Id)) ids.Add(order.Id); return order;
        }
        async Task ExpireLocally(Thesamenot.Api.Order order) => await db.ExecuteAsync("UPDATE orders SET expires_utc=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE id=@Id", order);
        try
        {
            var request = await Request(); transport.LoseNextSession = true;
            try { await Service().Checkout(request, owner); throw new InvalidOperationException("Expected an uncertain provider outcome."); } catch (Exception error) when (error is StripeException or HttpRequestException) { }
            var first = await OrderFor(request);
            Check(first.StripeSessionId is null && first.Status == "pending", "A lost session response must keep its reservation pending.");
            await Service().Checkout(request, owner);
            var recovered = await OrderFor(request);
            Check(transport.Sessions.Count == 1 && recovered.StripeSessionId is not null, "Retry after restart must reuse the provider idempotency key.");
            transport.MarkPaid(recovered.StripeSessionId!); await ExpireLocally(recovered); await Service().Reconcile();
            recovered = await OrderFor(request);
            Check(recovered.Status == "paid" && recovered.StripePaymentIntent is not null, "Missing payment webhook must recover through provider reconciliation.");

            var lost = await Request(); transport.LoseNextSession = true;
            try { await Service().Checkout(lost, owner); } catch (Exception error) when (error is StripeException or HttpRequestException) { }
            var unknown = await OrderFor(lost);
            transport.MarkPaid(transport.Sessions.Values.Single(value => value.OrderId == unknown.Id).Id);
            await ExpireLocally(unknown); await Service().Reconcile();
            Check((await OrderFor(lost)).Status == "paid", "Unknown session id must recover by provider client_reference_id.");

            var absent = await Request(); transport.FailBeforeSession = true;
            try { await Service().Checkout(absent, owner); } catch (Exception error) when (error is StripeException or HttpRequestException) { }
            var withoutSession = await OrderFor(absent);
            var before = await db.ExecuteScalarAsync<int>("SELECT available FROM variants WHERE id='hood-M'");
            await ExpireLocally(withoutSession); await Service().Reconcile(); await Service().Reconcile();
            Check((await OrderFor(absent)).Status == "expired" && await db.ExecuteScalarAsync<int>("SELECT available FROM variants WHERE id='hood-M'") == before + 1, "No remote session must release its reservation exactly once.");

            var expired = await Request(); await Service().Checkout(expired, owner); var expiring = await OrderFor(expired);
            transport.Sessions[expiring.StripeSessionId!].Status = "expired"; await ExpireLocally(expiring); await Service().Reconcile();
            Check((await OrderFor(expired)).ReservationStatus == "released", "Provider expiration must release stock.");

            var refundId = await database.PrepareRefund(recovered.Id, new(Guid.NewGuid().ToString(), 500, "Fixture pending refund", "", ""), "fixture");
            transport.NextRefundStatus = "pending";
            try { await Service().ProcessRefund(refundId); } catch (StoreException error) when (error.Status == 503) { }
            var pending = await database.RefundToProcess(refundId);
            Check(pending.Refund.State == "submitted" && pending.Refund.ProviderId is not null, "Pending refund must remain reserved in the refundable budget.");
            transport.Refunds[pending.Refund.ProviderId!].Status = "succeeded"; await Service().ProcessRefund(refundId); await Service().ProcessRefund(refundId);
            Check((await database.RefundToProcess(refundId)).Refund.State == "succeeded" && transport.Refunds.Count == 1, "Refund polling must not issue a second refund.");

            transport.NextRefundStatus = "failed";
            var failedId = await database.PrepareRefund(recovered.Id, new(Guid.NewGuid().ToString(), 100, "Fixture failed refund", "", ""), "fixture");
            await Service().ProcessRefund(failedId);
            Check((await database.RefundToProcess(failedId)).Refund.State == "failed", "Provider failure must be recorded without restocking.");

            transport.NextRefundStatus = "succeeded"; transport.LoseNextRefund = true;
            var uncertainId = await database.PrepareRefund(recovered.Id, new(Guid.NewGuid().ToString(), 200, "Fixture uncertain refund", "", ""), "fixture");
            try { await Service().ProcessRefund(uncertainId); } catch (Exception error) when (error is StripeException or HttpRequestException) { }
            await db.ExecuteAsync("UPDATE refunds SET created_utc=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 25 HOUR) WHERE id=@uncertainId", new { uncertainId });
            await Service().ProcessRefund(uncertainId);
            Check((await database.RefundToProcess(uncertainId)).Refund.State == "succeeded" && transport.Refunds.Count == 3, "Old uncertain refund must be looked up, never recreated after the provider idempotency window.");

            var reordered = await Request(); await Service().Checkout(reordered, owner); var reorderedOrder = await OrderFor(reordered);
            var session = transport.Sessions[reorderedOrder.StripeSessionId!];
            await database.RecordProviderSession(reorderedOrder.Id, session.Id, session.Intent);
            var observed = await database.ObserveProviderRefund("re_early_" + reorderedOrder.Id, session.Intent, null, reorderedOrder.TotalCents, "eur");
            await database.ApplyRefund(observed, "succeeded", "re_early_" + reorderedOrder.Id);
            transport.MarkPaid(session.Id); await ExpireLocally(reorderedOrder); await Service().Reconcile();
            var final = await OrderFor(reordered);
            Check(final.PaymentStatus == "refunded" && await db.ExecuteScalarAsync<int>("SELECT received_cents FROM payment_attempts WHERE order_id=@Id", final) == final.TotalCents, "Payment completion must preserve a refund observed before it.");
            var foreignRequest = await Request(); await Service().Checkout(foreignRequest, owner); var foreign = await OrderFor(foreignRequest);
            var eventId = "evt_currency_" + foreign.Id;
            var currencyEvent = JsonSerializer.Serialize(new {
                id = eventId, @object = "event", created = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                type = "checkout.session.completed", api_version = StripeConfiguration.ApiVersion,
                data = new { @object = new {
                    id = foreign.StripeSessionId, @object = "checkout.session", payment_status = "paid",
                    amount_total = foreign.TotalCents, currency = "usd", metadata = new { order_id = foreign.Id }
                }}
            });
            await database.EnqueueProviderEvent(eventId, currencyEvent);
            var currencyJobId = await database.JobIdByKey("stripe:" + eventId);
            var currencyJob = await database.LeaseJob("stripe-event", currencyJobId) ?? throw new InvalidOperationException("Currency fixture job is missing.");
            var runner = new Thesamenot.Api.Services.StoreJobRunner(database, Microsoft.Extensions.Logging.Abstractions.NullLogger<Thesamenot.Api.Services.StoreJobRunner>.Instance);
            await runner.Run(currencyJob, () => Service().ProcessProviderEvent(currencyEvent), CancellationToken.None);
            Check((await OrderFor(foreignRequest)).PaymentStatus == "pending"
                && await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM payment_incidents WHERE order_id=@Id AND reason='currency_mismatch'", foreign) == 1
                && await db.ExecuteScalarAsync<string>("SELECT state FROM background_jobs WHERE id=@id", new { id = currencyJobId }) == "dead",
                "A wrong-currency paid event must record an incident and dead-letter without marking the order paid.");
            Console.WriteLine("Ten Stripe SDK transport/worker contracts passed without network access: uncertain session/restart, missing webhook, unknown session, expiry, pending/failed/old uncertain refunds, reordered money events and wrong-currency incident/dead-letter.");
        }
        finally
        {
            foreach (var id in ids)
            {
                var order = await db.QuerySingleAsync<Thesamenot.Api.Order>("SELECT * FROM orders WHERE id=@id", new { id });
                var refunds = (await db.QueryAsync<string>("SELECT id FROM refunds WHERE order_id=@id", new { id })).ToArray();
                foreach (var refund in refunds) await db.ExecuteAsync("DELETE FROM background_jobs WHERE dedup_key=@key OR dedup_key LIKE @checkKey", new { key = "refund:" + refund, checkKey = "refund-check:" + refund + ":%" });
                await db.ExecuteAsync("DELETE FROM background_jobs WHERE dedup_key LIKE @key", new { key = "email:order:" + id + ":%" });
                if (order.ReservationStatus != "released")
                {
                    var lines = await db.QueryAsync<Thesamenot.Api.OrderItem>("SELECT * FROM order_items WHERE order_id=@id", new { id });
                    foreach (var line in lines) await db.ExecuteAsync("UPDATE variants SET available=available+@Quantity,version=version+1 WHERE id=@VariantId", line);
                }
                foreach (var table in new[] { "refunds", "payment_incidents", "inventory_movements", "order_reservations", "order_history", "payment_attempts", "order_items" })
                    await db.ExecuteAsync("DELETE FROM " + table + " WHERE order_id=@id", new { id });
                await db.ExecuteAsync("DELETE FROM orders WHERE id=@id", new { id });
            }
        }
    }
    private sealed class FixtureEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "PaymentContractChecks";
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = "";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    }
    private sealed class RemoteSession
    {
        public string Id = "", OrderId = "", Intent = "", Status = "open", PaymentStatus = "unpaid";
        public long Total;
        public object Json() => new
        {
            id = Id,
            @object = "checkout.session",
            client_reference_id = OrderId,
            payment_intent = Intent,
            status = Status,
            payment_status = PaymentStatus,
            amount_total = Total,
            currency = "eur",
            url = "https://checkout.stripe.test/" + Id,
            metadata = new { order_id = OrderId }
        };
    }
    private sealed class RemoteRefund
    {
        public string Id = "", Intent = "", Status = "", LocalId = "";
        public long Amount;
        public object Json() => new { id = Id, @object = "refund", payment_intent = Intent, status = Status, amount = Amount, currency = "eur", metadata = new { refund_id = LocalId } };
    }
    // Every request terminates in this handler. It never delegates to a network transport.
    private sealed class ProviderTransport : HttpMessageHandler
    {
        public readonly Dictionary<string, RemoteSession> Sessions = [];
        public readonly Dictionary<string, RemoteRefund> Refunds = [];
        private readonly Dictionary<string, string> sessionKeys = [], refundKeys = [];
        public bool LoseNextSession, FailBeforeSession, LoseNextRefund;
        public string NextRefundStatus = "succeeded";
        public void MarkPaid(string id) { Sessions[id].PaymentStatus = "paid"; Sessions[id].Status = "complete"; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var route = request.RequestUri!.AbsolutePath;
            object result;
            if (route == "/v1/checkout/sessions" && request.Method == HttpMethod.Post)
            {
                if (FailBeforeSession) { FailBeforeSession = false; throw new HttpRequestException("Fixture transport interruption."); }
                var form = QueryHelpers.ParseQuery(await request.Content!.ReadAsStringAsync(ct));
                var key = request.Headers.GetValues("Idempotency-Key").Single();
                if (!sessionKeys.TryGetValue(key, out var id))
                {
                    id = "cs_contract_" + Guid.NewGuid().ToString("N"); sessionKeys[key] = id;
                    var total = long.Parse(form["shipping_options[0][shipping_rate_data][fixed_amount][amount]"].ToString(), System.Globalization.CultureInfo.InvariantCulture);
                    for (var i = 0; form.ContainsKey("line_items[" + i + "][quantity]"); i++)
                        total += long.Parse(form["line_items[" + i + "][quantity]"].ToString()) * long.Parse(form["line_items[" + i + "][price_data][unit_amount]"].ToString());
                    Sessions[id] = new() { Id = id, OrderId = form["client_reference_id"].ToString(), Intent = "pi_" + id, Total = total };
                }
                if (LoseNextSession) { LoseNextSession = false; throw new HttpRequestException("Fixture response lost after provider creation."); }
                result = Sessions[id].Json();
            }
            else if (route == "/v1/checkout/sessions") result = new { @object = "list", has_more = false, data = Sessions.Values.Select(item => item.Json()) };
            else if (route.StartsWith("/v1/checkout/sessions/", StringComparison.Ordinal)) result = Sessions[route.Split('/').Last()].Json();
            else if (route == "/v1/refunds" && request.Method == HttpMethod.Post)
            {
                var form = QueryHelpers.ParseQuery(await request.Content!.ReadAsStringAsync(ct));
                var key = request.Headers.GetValues("Idempotency-Key").Single();
                if (!refundKeys.TryGetValue(key, out var id))
                {
                    id = "re_contract_" + Guid.NewGuid().ToString("N"); refundKeys[key] = id;
                    Refunds[id] = new() { Id = id, Intent = form["payment_intent"].ToString(), Amount = long.Parse(form["amount"].ToString()), LocalId = form["metadata[refund_id]"].ToString(), Status = NextRefundStatus };
                }
                if (LoseNextRefund) { LoseNextRefund = false; throw new HttpRequestException("Fixture refund response lost."); }
                result = Refunds[id].Json();
            }
            else if (route == "/v1/refunds") result = new { @object = "list", has_more = false, data = Refunds.Values.Select(item => item.Json()) };
            else if (route.StartsWith("/v1/refunds/", StringComparison.Ordinal)) result = Refunds[route.Split('/').Last()].Json();
            else throw new InvalidOperationException("Unexpected fixture provider route; no network request was made.");
            return new(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(result), Encoding.UTF8, "application/json") };
        }
    }
}
