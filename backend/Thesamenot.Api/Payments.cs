using Thesamenot.Api.Hosting;
using Stripe;
using Stripe.Checkout;

namespace Thesamenot.Api;

public sealed partial class Payments(StoreDatabase database, IConfiguration configuration, StoreOptions options, IWebHostEnvironment environment, IStripeClient? provider = null)
{
    public bool IsSimulation => environment.AllowsPaymentSimulation() && options.PaymentMode == "Simulation";
    public bool Ready => IsSimulation || (options.PaymentMode == "Stripe" && !string.IsNullOrWhiteSpace(configuration["Stripe:SecretKey"]) && !string.IsNullOrWhiteSpace(configuration["Stripe:WebhookSecret"]));
    private IStripeClient Client() => provider ?? new StripeClient(configuration["Stripe:SecretKey"]);
    private SessionService Sessions() => new(Client());
    // Historical provider transport contracts only. Public endpoints must use ManualCheckout.
    public async Task<object> Checkout(CheckoutRequest request, CheckoutOwner owner)
    {
        if (!options.SalesEnabled || (!IsSimulation && DateTimeOffset.UtcNow < options.DropOpensAt)) throw new StoreException(409, "The drop is not open yet.");
        if (!Ready) throw new StoreException(503, "Checkout is temporarily unavailable. Please try again later.");
        if (owner.UserId is not null) request = request with { Email = owner.Email! };
        request = request with { Email = request.Email.Trim().ToLowerInvariant(), Name = request.Name.Trim(), Address = request.Address.Trim(), City = request.City.Trim(), PostalCode = request.PostalCode.Trim(), Phone = request.Phone.Trim() };
        var order = await database.Find(request.RequestKey, owner);
        if (order is null)
        {
            try { order = await database.Reserve(request, options, owner); }
            catch (MySqlConnector.MySqlException e) when (e.Number == 1062) { order = await database.Find(request.RequestKey, owner); if (order is null) throw; }
        }
        if (order.PayloadHash != StoreDatabase.Hash(request)) throw new StoreException(409, "This checkout attempt changed. Start a new checkout.");
        if (order.Status != "pending") throw new StoreException(409, "This checkout has already finished. Start a new checkout.");
        if (order.PaymentMode != options.PaymentMode) throw new StoreException(409, "Payment settings changed. Please contact the store.");
        if (order.ExpiresUtc < DateTime.UtcNow) throw new StoreException(409, "This checkout expired. Start a new checkout.");
        if (order.CheckoutUrl is null)
        {
            if (IsSimulation) await database.AttachSession(order, null, $"{options.PublicUrl}/checkout/simulation?token={order.PublicToken}");
            else
            {
                // Retry uncertain network outcomes with the same Stripe idempotency key; keep stock reserved.
                var session = await Sessions().CreateAsync(new SessionCreateOptions
                {
                    Mode = "payment",
                    AllowedPaymentMethodTypes = ["card"],
                    CustomerEmail = order.Email,
                    ClientReferenceId = order.Id,
                    Metadata = new() { { "order_id", order.Id } },
                    SuccessUrl = $"{options.PublicUrl}/checkout/success?token={order.PublicToken}",
                    CancelUrl = $"{options.PublicUrl}/checkout?cancelled=1",
                    ExpiresAt = DateTime.SpecifyKind(order.CreatedUtc, DateTimeKind.Utc).AddMinutes(31),
                    LineItems = order.Items.Select(i => new SessionLineItemOptions
                    {
                        Quantity = i.Quantity,
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = "eur",
                            UnitAmount = i.UnitPriceCents,
                            ProductData = new SessionLineItemPriceDataProductDataOptions { Name = $"{i.ProductName} / {i.Size} / {i.Color}" }
                        }
                    }).ToList(),
                    ShippingOptions = [new SessionShippingOptionOptions {
                        ShippingRateData=new SessionShippingOptionShippingRateDataOptions {
                            Type="fixed_amount", DisplayName=order.ShippingMethod,
                            FixedAmount=new SessionShippingOptionShippingRateDataFixedAmountOptions {Amount=order.ShippingCents,Currency="eur"}
                        }
                    }]
                }, new RequestOptions { IdempotencyKey = order.Id });
                await database.AttachSession(order, session.Id, session.Url);
            }
        }
        return new { order.PublicToken, order.CheckoutUrl, order.TotalCents };
    }
    public async Task Webhook(string json, string signature)
    {
        if (string.IsNullOrWhiteSpace(configuration["Stripe:WebhookSecret"])) throw new StoreException(503, "Payments are not configured.");
        var evt = EventUtility.ConstructEvent(json, signature, configuration["Stripe:WebhookSecret"], throwOnApiVersionMismatch: !environment.IsDevelopment());
        if (evt.Livemode != (configuration["Stripe:SecretKey"]?.StartsWith("sk_live_", StringComparison.Ordinal) == true))
            throw new StoreException(400, "Webhook payment mode mismatch.");
        await database.EnqueueProviderEvent(evt.Id, json);
    }
    public async Task ProcessProviderEvent(string json)
    {
        var evt = EventUtility.ParseEvent(json, throwOnApiVersionMismatch: false);
        var time = new DateTimeOffset(DateTime.SpecifyKind(evt.Created, DateTimeKind.Utc)).ToUnixTimeSeconds();
        if (evt.Data.Object is Refund refund && evt.Type is ("refund.created" or "refund.updated" or "refund.failed"))
        {
            var local = refund.Metadata.GetValueOrDefault("refund_id");
            var refundId = await database.ObserveProviderRefund(refund.Id, refund.PaymentIntentId, local, checked((int)refund.Amount), refund.Currency);
            await database.ApplyRefund(refundId, refund.Status is "pending" or "requires_action" ? "submitted" : refund.Status, refund.Id, time); return;
        }
        if (evt.Data.Object is Dispute dispute && evt.Type.StartsWith("charge.dispute.", StringComparison.Ordinal))
        {
            await database.ObserveDispute(dispute.Id, dispute.PaymentIntentId, checked((int)dispute.Amount), dispute.Currency, dispute.Status, time); return;
        }
        if (evt.Data.Object is not Session session || evt.Type is not ("checkout.session.completed" or "checkout.session.expired")) return;
        if (!session.Metadata.TryGetValue("order_id", out var id)) throw new StoreException(400, "Missing order reference.");
        await database.RecordProviderSession(id, session.Id, session.PaymentIntentId);
        if (evt.Type == "checkout.session.completed" && session.PaymentStatus == "paid")
        {
            if (session.Currency != "eur")
            {
                await database.PaymentIncident(id, evt.Id, "currency_mismatch", checked((int)(session.AmountTotal ?? -1)), session.Currency ?? "unknown");
                throw new StoreException(400, "Unexpected payment currency.");
            }
            await database.Transition(id, "paid", evt.Id, session.Id, checked((int)(session.AmountTotal ?? -1)));
        }
        else if (evt.Type == "checkout.session.expired") await database.Transition(id, "expired", evt.Id, session.Id);
    }
    public async Task ProcessRefund(string id)
    {
        var (refund, order) = await database.RefundToProcess(id);
        if (refund.State is "succeeded" or "failed" or "canceled") return;
        if (order.PaymentMode == "Simulation")
        {
            if (!IsSimulation) throw new StoreException(409, "Simulation refunds are unavailable.");
            await database.ApplyRefund(id, "succeeded", "sim_" + id); return;
        }
        if (!Ready || string.IsNullOrWhiteSpace(order.StripePaymentIntent)) throw new StoreException(503, "Payment provider reconciliation is required.");
        var service = new RefundService(Client());
        if (refund.ProviderId is null && DateTime.UtcNow - refund.CreatedUtc >= TimeSpan.FromHours(23))
        {
            var filter = new RefundListOptions { PaymentIntent = order.StripePaymentIntent, Limit = 100 };
            Refund? found = null;
            while (true)
            {
                var page = await service.ListAsync(filter);
                found = page.Data.FirstOrDefault(item => item.Metadata.GetValueOrDefault("refund_id") == id);
                if (found is not null || !page.HasMore) break;
                filter.StartingAfter = page.Data.Last().Id;
            }
            if (found is null) throw new StoreException(400, "Refund outcome requires manual provider review before any new request.");
            await database.ApplyRefund(id, found.Status is "pending" or "requires_action" ? "submitted" : found.Status, found.Id);
            if (found.Status is "pending" or "requires_action") throw new StoreException(503, "Refund is pending.");
            return;
        }
        Refund result;
        try
        {
            result = refund.ProviderId is null
                ? await service.CreateAsync(new RefundCreateOptions { PaymentIntent = order.StripePaymentIntent, Amount = refund.AmountCents, Metadata = new() { { "refund_id", id }, { "order_id", order.Id } } }, new RequestOptions { IdempotencyKey = "refund:" + id })
                : await service.GetAsync(refund.ProviderId);
        }
        catch (StripeException error) when (error.HttpStatusCode == System.Net.HttpStatusCode.BadRequest)
        {
            await database.ApplyRefund(id, "failed");
            throw new StoreException(400, "The provider rejected this refund. Review the payment before making a new request.");
        }
        await database.ApplyRefund(id, result.Status is "pending" or "requires_action" ? "submitted" : result.Status, result.Id);
        if (result.Status is "pending" or "requires_action") throw new StoreException(503, "Refund is still pending at the provider.");
    }
    public async Task CompleteSimulation(string token)
    {
        if (!IsSimulation) throw new StoreException(404, "Not found.");
        var order = await database.PublicOrder(token) ?? throw new StoreException(404, "Order not found.");
        if (order.PaymentMode != "Simulation") throw new StoreException(400, "Not a simulation order.");
        if (order.ExpiresUtc < DateTime.UtcNow) { await database.Transition(order.Id, "expired"); throw new StoreException(409, "This checkout expired."); }
        await database.Transition(order.Id, "paid");
    }
    public async Task Reconcile()
    {
        await database.ScheduleRefundReconciliation();
        foreach (var order in await database.Expiring())
        {
            await ReconcileOrder(order.Id);
        }
    }
    public async Task ReconcileOrder(string id)
    {
        var order = await database.AdminOrder(id);
        if (order.Status != "pending" || order.ExpiresUtc > DateTime.UtcNow) return;
        if (order.PaymentMode == "Simulation") { await database.Transition(order.Id, "expired"); return; }
        if (options.PaymentMode != "Stripe" || !Ready) throw new StoreException(503, "Stripe reconciliation is not configured.");
        if (order.StripeSessionId is null)
        {
            // Find a possibly-created session before releasing reservations from a timed-out request.
            var filter = new SessionListOptions { Created = new DateRangeOptions { GreaterThanOrEqual = DateTime.SpecifyKind(order.CreatedUtc, DateTimeKind.Utc).AddMinutes(-1), LessThanOrEqual = DateTime.SpecifyKind(order.ExpiresUtc, DateTimeKind.Utc) }, Limit = 100 };
            var sessions = await Sessions().ListAsync(filter);
            Session? found = null;
            while (true)
            {
                found = sessions.Data.FirstOrDefault(s => s.ClientReferenceId == order.Id);
                if (found is not null || !sessions.HasMore) break;
                filter.StartingAfter = sessions.Data.Last().Id; sessions = await Sessions().ListAsync(filter);
            }
            if (found is null) { await database.Transition(order.Id, "expired"); return; }
            await database.AttachSession(order, found.Id, found.Url ?? "");
        }
        var session = await Sessions().GetAsync(order.StripeSessionId);
        await database.RecordProviderSession(order.Id, session.Id, session.PaymentIntentId);
        if (session.PaymentStatus == "paid" && session.Currency == "eur") await database.Transition(order.Id, "paid", stripeSessionId: session.Id, paidAmount: checked((int)(session.AmountTotal ?? -1)));
        else if (session.Status == "expired") await database.Transition(order.Id, "expired", stripeSessionId: session.Id);
        else throw new StoreException(503, "The provider checkout has not reached a terminal state.");
    }
}
public sealed class ReservationWorker(StoreDatabase database, ILogger<ReservationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try { await database.ScheduleReconciliation(); await database.ScheduleRefundReconciliation(); } catch { logger.LogWarning("Reservation reconciliation scheduling will retry."); }
        }
    }
}
