using Dapper;
namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    public async Task<string> CreateReturn(ReturnRequest request, string? userId, string? grantId)
    {
        if (!Guid.TryParse(request.RequestKey, out _) || request.Kind is not ("return" or "withdrawal") || request.Reason is null || request.Reason.Length > 1000 ||
            request.Items is not { Count: >= 1 and <= 8 } || request.Items.Any(i => i.Quantity is < 1 or > 10) || request.Items.Select(i => i.OrderItemId).Distinct().Count() != request.Items.Count)
            throw new StoreException(400, "Check the return request and quantities.");
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleOrDefaultAsync<Order>("SELECT * FROM orders WHERE id=@OrderId FOR UPDATE", request, tx) ?? throw new StoreException(404, "Order not found.");
        var customer = userId is not null && order.UserId == userId;
        var guest = order.UserId is null && grantId is not null && await db.ExecuteScalarAsync<int>("""
            SELECT COUNT(*) FROM order_access_tokens WHERE id=@grantId AND order_id=@Id AND purpose='access'
            AND used_utc IS NOT NULL AND revoked_utc IS NULL AND expires_utc>UTC_TIMESTAMP(6)
            """, new { grantId, order.Id }, tx) == 1;
        if (!customer && !guest) throw new StoreException(404, "Order not found.");
        var existing = await db.ExecuteScalarAsync<string>("SELECT id FROM return_requests WHERE order_id=@Id AND request_key=@RequestKey", new { order.Id, request.RequestKey }, tx);
        if (existing is not null)
        {
            var original = await db.QuerySingleAsync<ReturnOriginal>("SELECT kind,reason FROM return_requests WHERE id=@existing", new { existing }, tx);
            var originalLines = (await db.QueryAsync<ReturnInventoryLine>("SELECT order_item_id,quantity FROM return_items WHERE return_id=@existing", new { existing }, tx)).ToList();
            if (original.Kind != request.Kind || original.Reason != request.Reason || originalLines.Count != request.Items.Count ||
                request.Items.Any(line => !originalLines.Any(item => item.OrderItemId == line.OrderItemId && item.Quantity == line.Quantity)))
                throw new StoreException(409, "This return request changed. Use a new request.");
            await tx.CommitAsync(); return existing;
        }
        var confirmed = order.PaymentStatus is "succeeded" or "partially_refunded" or "refunded" ||
            order.PaymentMode == ManualPaymentMethods.CashOnDelivery && order.Status == "fulfilled";
        if (!confirmed || order.ReservationStatus != "consumed")
            throw new StoreException(409, "A return request requires a confirmed order.");
        var items = (await db.QueryAsync<OrderItem>("SELECT * FROM order_items WHERE order_id=@Id", order, tx)).ToList();
        foreach (var line in request.Items)
        {
            var item = items.SingleOrDefault(i => i.Id == line.OrderItemId) ?? throw new StoreException(400, "A return item does not belong to this order.");
            var claimed = await db.ExecuteScalarAsync<int>("SELECT COALESCE(SUM(i.quantity),0) FROM return_items i JOIN return_requests r ON r.id=i.return_id WHERE i.order_item_id=@Id AND r.state<>'rejected'", item, tx);
            if (line.Quantity > item.Quantity - claimed) throw new StoreException(409, "Return quantity exceeds the remaining purchased quantity.");
        }
        var id = Guid.NewGuid().ToString("N");
        await db.ExecuteAsync("INSERT INTO return_requests(id,order_id,request_key,kind,reason) VALUES(@id,@OrderId,@RequestKey,@Kind,@Reason)", new { id, request.OrderId, request.RequestKey, request.Kind, request.Reason }, tx);
        foreach (var line in request.Items) await db.ExecuteAsync("INSERT INTO return_items(return_id,order_item_id,quantity) VALUES(@id,@OrderItemId,@Quantity)", new { id, line.OrderItemId, line.Quantity }, tx);
        await History(db, tx, order.Id, "return.requested", request.Kind == "withdrawal" ? "Withdrawal request received." : "Return request received.", userId ?? "guest");
        await EnqueueJob(db, tx, "email:return:" + id, "email", new EmailJob(order.Email, "return-received", Text: "Order " + order.OrderNumber + "\nWe received your " + request.Kind + " request. Reference: " + id + ". The store will review it and provide instructions."));
        await tx.CommitAsync(); return id;
    }
    public async Task UpdateReturn(string id, ReturnUpdate request, string actor)
    {
        if (request.Reason is null || request.Reason.Length > 700 || (request.State == "rejected" && string.IsNullOrWhiteSpace(request.Reason)))
            throw new StoreException(400, "A rejection requires a decision note (up to 700 characters).");
        await using var db = await Open(); var orderId = await db.ExecuteScalarAsync<string>("SELECT order_id FROM return_requests WHERE id=@id", new { id }) ?? throw new StoreException(404, "Return not found.");
        await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleAsync<Order>("SELECT * FROM orders WHERE id=@orderId FOR UPDATE", new { orderId }, tx);
        var current = await db.QuerySingleAsync<ReturnState>("SELECT state,version FROM return_requests WHERE id=@id FOR UPDATE", new { id }, tx);
        if (current.Version != request.Version || !((current.State == "requested" && request.State is "approved" or "rejected") || (current.State == "received" && request.State == "closed")))
            throw new StoreException(409, "Refresh the return. Allowed actions are approve/reject a request or close a received return.");
        await db.ExecuteAsync("UPDATE return_requests SET state=@State,version=version+1,updated_utc=UTC_TIMESTAMP(6) WHERE id=@id", new { id, request.State }, tx);
        if (request.State == "closed" && string.IsNullOrWhiteSpace(request.Reason) && await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM return_items WHERE return_id=@id AND received_quantity<quantity", new { id }, tx) > 0)
            throw new StoreException(400, "Add a decision note before closing a partially received return.");
        await History(db, tx, orderId, "return." + request.State, "Return request " + request.State + ". " + request.Reason.Trim(), actor);
        var instructions = request.State == "approved" ? (configuration["Merchant:ReturnInstructions"] ?? "Preview: return instructions have not been configured. Contact the store.") : "";
        await EnqueueJob(db, tx, "email:return-state:" + id + ":" + request.State, "email", new EmailJob(order.Email, "return-" + request.State, Text: "Order " + order.OrderNumber + "\nReturn request " + request.State + ".\n" + request.Reason.Trim() + "\n" + instructions));
        await Audit(db, tx, actor, "return." + request.State, id); await tx.CommitAsync();
    }
    private sealed class ReturnState
    {
        public string State { get; set; } = "";
        public int Version { get; set; }
    }
    private sealed class ReturnOriginal
    {
        public string Kind { get; set; } = "";
        public string Reason { get; set; } = "";
    }
    private sealed class ReturnInventoryLine
    {
        public long OrderItemId { get; set; }
        public string VariantId { get; set; } = "";
        public string ProductId { get; set; } = "";
        public int Quantity { get; set; }
        public int ReceivedQuantity { get; set; }
        public int RestockedQuantity { get; set; }
    }
    public async Task InspectReturn(string id, ReturnInspection request, string actor)
    {
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 300 || request.Items is not { Count: >= 1 and <= 8 } ||
            request.Items.Select(i => i.OrderItemId).Distinct().Count() != request.Items.Count) throw new StoreException(400, "Inspection items and a restock decision reason are required.");
        await using var db = await Open(); var orderId = await db.ExecuteScalarAsync<string>("SELECT order_id FROM return_requests WHERE id=@id", new { id }) ?? throw new StoreException(404, "Return not found.");
        await using var tx = await db.BeginTransactionAsync();
        await db.QuerySingleAsync<string>("SELECT id FROM orders WHERE id=@orderId FOR UPDATE", new { orderId }, tx);
        var current = await db.QuerySingleAsync<ReturnState>("SELECT state,version FROM return_requests WHERE id=@id FOR UPDATE", new { id }, tx);
        if (current.Version != request.Version || current.State is not ("approved" or "received")) throw new StoreException(409, "Approve this return first, or refresh its current version.");
        var lines = (await db.QueryAsync<ReturnInventoryLine>("""
            SELECT ri.*,oi.variant_id,v.product_id FROM return_items ri JOIN order_items oi ON oi.id=ri.order_item_id
            JOIN variants v ON v.id=oi.variant_id WHERE ri.return_id=@id ORDER BY v.product_id,v.id
            """, new { id }, tx)).ToList();
        await db.QueryAsync<string>("SELECT id FROM products WHERE id IN @ids ORDER BY id FOR UPDATE", new { ids = lines.Select(i => i.ProductId).Distinct().ToArray() }, tx);
        foreach (var decision in request.Items.OrderBy(i => lines.Find(l => l.OrderItemId == i.OrderItemId)?.VariantId, StringComparer.Ordinal))
        {
            var line = lines.SingleOrDefault(l => l.OrderItemId == decision.OrderItemId) ?? throw new StoreException(400, "Unknown return item.");
            if (decision.ReceivedQuantity < line.ReceivedQuantity || decision.ReceivedQuantity > line.Quantity ||
                decision.RestockQuantity < line.RestockedQuantity || decision.RestockQuantity > decision.ReceivedQuantity)
                throw new StoreException(400, "Inspection quantities cannot exceed returned units or undo a previous stock movement.");
            var delta = decision.RestockQuantity - line.RestockedQuantity;
            await db.ExecuteAsync("UPDATE return_items SET received_quantity=@ReceivedQuantity,restocked_quantity=@RestockQuantity WHERE return_id=@id AND order_item_id=@OrderItemId", new { id, decision.OrderItemId, decision.ReceivedQuantity, decision.RestockQuantity }, tx);
            if (delta > 0)
            {
                await db.ExecuteAsync("UPDATE variants SET available=available+@delta,version=version+1 WHERE id=@VariantId", new { delta, line.VariantId }, tx);
                await db.ExecuteAsync("INSERT INTO inventory_movements(variant_id,order_id,delta,reason,actor) VALUES(@VariantId,@orderId,@delta,@Reason,@actor)", new { line.VariantId, orderId, delta, request.Reason, actor }, tx);
            }
        }
        await db.ExecuteAsync("UPDATE return_requests SET state='received',version=version+1,updated_utc=UTC_TIMESTAMP(6) WHERE id=@id", new { id }, tx);
        await History(db, tx, orderId, "return.inspected", "Returned units inspected. Restock was recorded separately from any refund.", actor);
        await Audit(db, tx, actor, "return.inspected", id); await tx.CommitAsync();
    }
}
