using Dapper;
namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    public async Task ScheduleRefundReconciliation()
    {
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        await db.ExecuteAsync("DELETE FROM auth_rate_windows WHERE window_utc<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 2 HOUR) LIMIT 1000", transaction: tx);
        await db.ExecuteAsync("DELETE FROM checkout_quotes WHERE expires_utc<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY) LIMIT 1000", transaction: tx);
        var period = DateTime.UtcNow.ToString("yyyyMMddHH");
        var ids = await db.QueryAsync<string>("""
            SELECT r.id FROM refunds r WHERE r.state='submitted' AND r.provider_id IS NOT NULL
              AND NOT EXISTS(SELECT 1 FROM background_jobs j WHERE j.dedup_key=CONCAT('refund-check:',r.id,':',@period))
            ORDER BY r.updated_utc,r.id LIMIT 100
            """, new { period }, tx);
        foreach (var id in ids) await EnqueueJob(db, tx, "refund-check:" + id + ":" + period, "refund", new RefundJob(id));
        await tx.CommitAsync();
    }
    public async Task<object> AdminOrderPage(int page, string? search)
    {
        Validation.AccountValidation.Pagination(page, 24);
        if ((search?.Length ?? 0) > 120) throw new StoreException(400, "Search is too long.");
        await using var db = await Open();
        var args = new { search = "%" + (search ?? "").Replace("!", "!!").Replace("%", "!%").Replace("_", "!_") + "%", offset = (page - 1) * 24 };
        const string filter = " FROM orders WHERE order_number LIKE @search ESCAPE '!' OR email LIKE @search ESCAPE '!'";
        return new
        {
            items = await db.QueryAsync("SELECT id,order_number number,email,status,payment_mode paymentMode,payment_status paymentStatus,fulfillment_status fulfillmentStatus,total_cents totalCents,created_utc createdUtc,version" + filter + " ORDER BY created_utc DESC,id DESC LIMIT 24 OFFSET @offset", args),
            page,
            pageSize = 24,
            total = await db.ExecuteScalarAsync<int>("SELECT COUNT(*)" + filter, args)
        };
    }
    public async Task<Order> AdminOrder(string id)
    {
        await using var db = await Open(); return await Load(db, "id", id) ?? throw new StoreException(404, "Order not found.");
    }
    public async Task<object> OrderOperations(string id, bool admin = false)
    {
        await using var db = await Open();
        return new
        {
            history = await db.QueryAsync("SELECT id,event_type eventType,detail,created_utc createdUtc FROM order_history WHERE order_id=@id ORDER BY id", new { id }),
            shipments = await db.QueryAsync("SELECT courier,tracking_number trackingNumber,tracking_url trackingUrl,created_utc createdUtc FROM shipments WHERE order_id=@id", new { id }),
            refunds = await db.QueryAsync("SELECT id,amount_cents amountCents,state,created_utc createdUtc FROM refunds WHERE order_id=@id ORDER BY created_utc,id", new { id }),
            disputes = await db.QueryAsync("SELECT " + (admin ? "provider_id providerId," : "") + "amount_cents amountCents,currency,state FROM disputes WHERE order_id=@id ORDER BY created_utc,provider_id", new { id }),
            returns = await db.QueryAsync("SELECT id,kind,reason,state,version,created_utc createdUtc FROM return_requests WHERE order_id=@id ORDER BY created_utc,id", new { id }),
            returnItems = await db.QueryAsync("SELECT i.return_id returnId,i.order_item_id orderItemId,i.quantity,i.received_quantity receivedQuantity,i.restocked_quantity restockedQuantity FROM return_items i JOIN return_requests r ON r.id=i.return_id WHERE r.order_id=@id", new { id })
        };
    }
    public async Task RecordProviderSession(string orderId, string session, string? intent)
    {
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleOrDefaultAsync<Order>("SELECT * FROM orders WHERE id=@orderId FOR UPDATE", new { orderId }, tx) ?? throw new StoreException(404, "Order not found.");
        if (order.PaymentMode != "Stripe" || (order.StripeSessionId is not null && order.StripeSessionId != session)) throw new StoreException(400, "Payment session mismatch.");
        await db.ExecuteAsync("UPDATE orders SET stripe_session_id=@session,stripe_payment_intent=COALESCE(@intent,stripe_payment_intent) WHERE id=@orderId", new { orderId, session, intent }, tx);
        await db.ExecuteAsync("UPDATE payment_attempts SET provider_session=@session,payment_intent=COALESCE(@intent,payment_intent) WHERE order_id=@orderId", new { orderId, session, intent }, tx);
        await tx.CommitAsync();
    }
    public async Task PaymentIncident(string orderId, string eventId, string reason, int? amount, string currency)
    {
        await using var db = await Open();
        await db.ExecuteAsync("INSERT IGNORE INTO payment_incidents(order_id,event_id,reason,amount_cents,currency) VALUES(@orderId,@eventId,@reason,@amount,@currency)", new { orderId, eventId, reason, amount, currency = currency[..Math.Min(currency.Length, 10)] });
    }
    public async Task<string> PrepareRefund(string orderId, RefundRequest request, string actor)
    {
        if (!Guid.TryParse(request.RequestKey, out _) || request.AmountCents < 1 || string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 300)
            throw new StoreException(400, "Refund amount, reason and request key are required.");
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleOrDefaultAsync<Order>("SELECT * FROM orders WHERE id=@orderId FOR UPDATE", new { orderId }, tx) ?? throw new StoreException(404, "Order not found.");
        var existing = await db.QuerySingleOrDefaultAsync<StoreRefund>("SELECT * FROM refunds WHERE order_id=@orderId AND request_key=@RequestKey", new { orderId, request.RequestKey }, tx);
        if (existing is not null)
        {
            if (existing.AmountCents != request.AmountCents || existing.Reason != request.Reason) throw new StoreException(409, "Refund request changed.");
            return existing.Id;
        }
        if (order.PaymentStatus is not ("succeeded" or "partially_refunded")) throw new StoreException(409, "Only confirmed payments can be refunded.");
        if (await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM disputes WHERE order_id=@orderId AND state NOT IN ('won','warning_closed')", new { orderId }, tx) > 0)
            throw new StoreException(409, "Review the active dispute before refunding.");
        var committed = await db.ExecuteScalarAsync<int>("SELECT COALESCE(SUM(amount_cents),0) FROM refunds WHERE order_id=@orderId AND state IN ('pending','submitted','succeeded')", new { orderId }, tx);
        if (request.AmountCents > order.TotalCents - committed) throw new StoreException(409, "Refund exceeds the remaining refundable amount.");
        var id = Guid.NewGuid().ToString("N");
        await db.ExecuteAsync("INSERT INTO refunds(id,order_id,request_key,amount_cents,reason) VALUES(@id,@orderId,@RequestKey,@AmountCents,@Reason)", new { id, orderId, request.RequestKey, request.AmountCents, request.Reason }, tx);
        if (ManualPaymentMethods.IsManual(order.PaymentMode))
        {
            // The operator records a refund already sent outside the application; no money is moved here.
            await db.ExecuteAsync("UPDATE refunds SET state='succeeded' WHERE id=@id", new { id }, tx);
            var totalRefunded = committed + request.AmountCents;
            await db.ExecuteAsync("UPDATE orders SET payment_status=@state,version=version+1 WHERE id=@orderId", new { orderId, state = totalRefunded >= order.TotalCents ? "refunded" : "partially_refunded" }, tx);
            await History(db, tx, orderId, "refund.succeeded", "Manual refund recorded: " + request.AmountCents + " cents. Reference: " + request.Reason, actor);
            await EnqueueJob(db, tx, "email:refund:" + id, "email", new EmailJob(order.Email, "refund-confirmed", Text: "Order " + order.OrderNumber + "\nThe store recorded a refund of " + (request.AmountCents / 100m).ToString("0.00", System.Globalization.CultureInfo.InvariantCulture) + " EUR."));
        }
        else await EnqueueJob(db, tx, "refund:" + id, "refund", new RefundJob(id));
        if (!ManualPaymentMethods.IsManual(order.PaymentMode))
            await History(db, tx, orderId, "refund.requested", "Refund requested: " + request.AmountCents + " cents.", actor);
        await Audit(db, tx, actor, ManualPaymentMethods.IsManual(order.PaymentMode) ? "refund.manual-recorded" : "refund.requested", id);
        await tx.CommitAsync(); return id;
    }
    public async Task<(StoreRefund Refund, Order Order)> RefundToProcess(string id)
    {
        await using var db = await Open(); var refund = await db.QuerySingleAsync<StoreRefund>("SELECT * FROM refunds WHERE id=@id", new { id });
        return (refund, await Load(db, "id", refund.OrderId) ?? throw new StoreException(404, "Order not found."));
    }
    public async Task ApplyRefund(string id, string state, string? providerId = null, long eventTime = 0)
    {
        if (state is not ("pending" or "submitted" or "succeeded" or "failed" or "canceled")) throw new StoreException(400, "Unknown refund state.");
        await using var db = await Open(); var orderId = await db.ExecuteScalarAsync<string>("SELECT order_id FROM refunds WHERE id=@id", new { id });
        if (orderId is null) throw new StoreException(404, "Refund not found.");
        await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleAsync<Order>("SELECT * FROM orders WHERE id=@orderId FOR UPDATE", new { orderId }, tx);
        var refund = await db.QuerySingleAsync<StoreRefund>("SELECT * FROM refunds WHERE id=@id FOR UPDATE", new { id }, tx);
        var seen = await db.ExecuteScalarAsync<long>("SELECT seen_event FROM refunds WHERE id=@id", new { id }, tx);
        if (refund.State == "succeeded" || (seen > eventTime && eventTime != 0) || (refund.State is "failed" or "canceled" && state is "pending" or "submitted")) return;
        if (refund.ProviderId is not null && providerId is not null && refund.ProviderId != providerId) throw new StoreException(409, "Refund provider id mismatch.");
        await db.ExecuteAsync("UPDATE refunds SET state=@state,provider_id=COALESCE(@providerId,provider_id),seen_event=GREATEST(seen_event,@eventTime),updated_utc=UTC_TIMESTAMP(6) WHERE id=@id", new { id, state, providerId, eventTime }, tx);
        var refunded = await db.ExecuteScalarAsync<int>("SELECT COALESCE(SUM(amount_cents),0) FROM refunds WHERE order_id=@orderId AND state='succeeded'", new { orderId }, tx);
        if (refunded > 0) await db.ExecuteAsync("UPDATE orders SET payment_status=@status,version=version+1 WHERE id=@orderId", new { orderId, status = refunded >= order.TotalCents ? "refunded" : "partially_refunded" }, tx);
        if (state != refund.State)
        {
            await History(db, tx, orderId, "refund." + state, "Refund " + state + ": " + refund.AmountCents + " cents.");
            if (state == "succeeded") await EnqueueJob(db, tx, "email:refund:" + id, "email", new EmailJob(order.Email, "refund-confirmed", Text: "Order " + order.OrderNumber + "\nRefund confirmed: " + (refund.AmountCents / 100m).ToString("0.00") + " " + order.Currency + "."));
        }
        await tx.CommitAsync();
    }
    public async Task<string> ObserveProviderRefund(string providerId, string? intent, string? localId, int amount, string currency)
    {
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleOrDefaultAsync<Order>("SELECT * FROM orders WHERE stripe_payment_intent=@intent FOR UPDATE", new { intent }, tx) ?? throw new StoreException(409, "Refund awaits payment reconciliation.");
        if (currency.ToUpperInvariant() != order.Currency || amount < 1) throw new StoreException(400, "Refund currency or amount mismatch.");
        var existing = await db.QuerySingleOrDefaultAsync<StoreRefund>("SELECT * FROM refunds WHERE provider_id=@providerId OR (id=@localId AND order_id=@Id) LIMIT 1 FOR UPDATE", new { providerId, localId, order.Id }, tx);
        if (existing is not null)
        {
            if (existing.OrderId != order.Id || existing.AmountCents != amount) throw new StoreException(400, "Refund reference mismatch.");
            await tx.CommitAsync(); return existing.Id;
        }
        var id = Guid.NewGuid().ToString("N");
        await db.ExecuteAsync("INSERT INTO refunds(id,order_id,request_key,amount_cents,reason,provider_id) VALUES(@id,@orderId,@requestKey,@amount,'Refund recorded from provider',@providerId)", new { id, orderId = order.Id, requestKey = Guid.NewGuid().ToString(), amount, providerId }, tx);
        await tx.CommitAsync(); return id;
    }
    public async Task ObserveDispute(string providerId, string? intent, int amount, string currency, string state, long eventTime)
    {
        if (string.IsNullOrWhiteSpace(state) || state.Length > 60 || currency is not { Length: 3 }) throw new StoreException(400, "Invalid dispute.");
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleOrDefaultAsync<Order>("SELECT * FROM orders WHERE stripe_payment_intent=@intent FOR UPDATE", new { intent }, tx) ?? throw new StoreException(409, "Dispute awaits payment reconciliation.");
        await db.ExecuteAsync("""
            INSERT INTO disputes(provider_id,order_id,amount_cents,state,seen_event,currency) VALUES(@providerId,@Id,@amount,@state,@eventTime,@currency)
            ON DUPLICATE KEY UPDATE state=IF(seen_event<=@eventTime,@state,state),seen_event=GREATEST(seen_event,@eventTime),updated_utc=UTC_TIMESTAMP(6)
            """, new { providerId, order.Id, amount, state, eventTime, currency = currency.ToUpperInvariant() }, tx);
        await History(db, tx, order.Id, "payment.dispute", "Payment dispute update received. Review it in the payment provider.");
        await tx.CommitAsync();
    }
    public async Task ShipOrder(string id, ShipmentRequest request, string actor)
    {
        if (string.IsNullOrWhiteSpace(request.Courier) || request.Courier.Length > 120 || string.IsNullOrWhiteSpace(request.TrackingNumber) || request.TrackingNumber.Length > 120 ||
            request.TrackingUrl is null || request.TrackingUrl.Length > 1000 || (request.TrackingUrl.Length > 0 && (!Uri.TryCreate(request.TrackingUrl, UriKind.Absolute, out var url) || url.Scheme != "https" || url.UserInfo.Length > 0)))
            throw new StoreException(400, "Enter courier and tracking details. Tracking links must use HTTPS.");
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleOrDefaultAsync<Order>("SELECT * FROM orders WHERE id=@id FOR UPDATE", new { id }, tx) ?? throw new StoreException(404, "Order not found.");
        var dispatchable = order.Status == "paid" && order.PaymentStatus is "succeeded" or "partially_refunded" ||
            order.PaymentMode == ManualPaymentMethods.CashOnDelivery && order.Status == "confirmed" && order.PaymentStatus == "pending";
        if (order.Version != request.Version || !dispatchable || order.ReservationStatus != "consumed" ||
            await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM refunds WHERE order_id=@id AND state IN ('pending','submitted')", new { id }, tx) > 0 ||
            await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM disputes WHERE order_id=@id AND state NOT IN ('won','warning_closed')", new { id }, tx) > 0)
            throw new StoreException(409, "Refresh this order. Dispatch requires a confirmed deposit or cash on delivery, committed stock and no pending refund or dispute.");
        await db.ExecuteAsync("INSERT INTO shipments(id,order_id,courier,tracking_number,tracking_url) VALUES(@shipment,@id,@Courier,@TrackingNumber,@TrackingUrl)", new { shipment = Guid.NewGuid().ToString("N"), id, request.Courier, request.TrackingNumber, request.TrackingUrl }, tx);
        await db.ExecuteAsync("UPDATE orders SET status='fulfilled',fulfillment_status='shipped',version=version+1 WHERE id=@id", new { id }, tx);
        await History(db, tx, id, "order.shipped", "Shipped with " + request.Courier + ". Tracking: " + request.TrackingNumber, actor);
        await EnqueueJob(db, tx, "email:shipped:" + id, "email", new EmailJob(order.Email, "order-shipped", Text: "Order " + order.OrderNumber + "\n" + request.Courier + "\nTracking: " + request.TrackingNumber + "\n" + request.TrackingUrl));
        await Audit(db, tx, actor, "order.shipped", id); await tx.CommitAsync();
    }
}
