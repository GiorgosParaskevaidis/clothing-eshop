using Dapper;
using Thesamenot.Api.Validation;

namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    public async Task ConfirmManualPayment(string id, ManualPaymentUpdate request, string actor)
    {
        RequestValidation.ValidateManualPayment(request);
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleOrDefaultAsync<Order>("SELECT * FROM orders WHERE id=@id FOR UPDATE", new { id }, tx)
            ?? throw new StoreException(404, "Order not found.");
        if (!ManualPaymentMethods.IsManual(order.PaymentMode) || order.Version != request.Version ||
            order.PaymentStatus != "pending" || request.AmountCents != order.TotalCents ||
            !(order.PaymentMode == ManualPaymentMethods.BankTransfer && order.Status == "awaiting_payment" ||
              order.PaymentMode == ManualPaymentMethods.CashOnDelivery && order.Status == "fulfilled"))
            throw new StoreException(409, "Refresh the order. Confirm the full deposit, or courier collection after dispatch, only once.");
        await db.ExecuteAsync("UPDATE orders SET status=IF(status='fulfilled',status,'paid'),payment_status='succeeded',reservation_status='consumed',version=version+1 WHERE id=@id", new { id }, tx);
        await db.ExecuteAsync("UPDATE order_reservations SET state='consumed' WHERE order_id=@id", new { id }, tx);
        await db.ExecuteAsync("UPDATE payment_attempts SET state='succeeded',received_cents=@AmountCents,updated_utc=UTC_TIMESTAMP(6) WHERE order_id=@id", new { id, request.AmountCents }, tx);
        await History(db, tx, id, "payment.succeeded", "Receipt confirmed: " + request.AmountCents + " cents. Reference: " + request.Reference.Trim(), actor);
        await Audit(db, tx, actor, "payment.manual-confirmed", id);
        await EnqueueJob(db, tx, "email:order:" + id + ":paid", "email", new EmailJob(order.Email, "order-paid", Text: "Order " + order.OrderNumber + "\nPayment received and confirmed by the store."));
        await tx.CommitAsync();
    }

    public async Task CancelManualOrder(string id, ManualOrderCancellation request, string actor)
    {
        RequestValidation.ValidateManualCancellation(request);
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleOrDefaultAsync<Order>("SELECT * FROM orders WHERE id=@id FOR UPDATE", new { id }, tx)
            ?? throw new StoreException(404, "Order not found.");
        if (!ManualPaymentMethods.IsManual(order.PaymentMode) || order.Version != request.Version ||
            order.Status is not ("awaiting_payment" or "confirmed") || order.PaymentStatus != "pending" || order.FulfillmentStatus != "unfulfilled")
            throw new StoreException(409, "Only an unpaid, undispatched order can be cancelled. Refresh this order.");
        var lines = await db.QueryAsync<OrderItem>("SELECT * FROM order_items WHERE order_id=@id ORDER BY variant_id", new { id }, tx);
        await db.QueryAsync<string>("SELECT id FROM products WHERE id IN (SELECT v.product_id FROM variants v JOIN order_items i ON i.variant_id=v.id WHERE i.order_id=@id) ORDER BY id FOR UPDATE", new { id }, tx);
        foreach (var line in lines)
        {
            await db.ExecuteAsync("UPDATE variants SET available=available+@Quantity,version=version+1 WHERE id=@VariantId", line, tx);
            await db.ExecuteAsync("INSERT INTO inventory_movements(variant_id,order_id,delta,reason,actor) VALUES(@VariantId,@id,@Quantity,@Reason,@actor)", new { line.VariantId, id, line.Quantity, request.Reason, actor }, tx);
        }
        await db.ExecuteAsync("UPDATE orders SET status='cancelled',payment_status='unpaid',reservation_status='released',version=version+1 WHERE id=@id", new { id }, tx);
        await db.ExecuteAsync("UPDATE order_reservations SET state='released' WHERE order_id=@id", new { id }, tx);
        await db.ExecuteAsync("UPDATE payment_attempts SET state='unpaid',updated_utc=UTC_TIMESTAMP(6) WHERE order_id=@id", new { id }, tx);
        await History(db, tx, id, "order.cancelled", "Order cancelled: " + request.Reason.Trim(), actor);
        await Audit(db, tx, actor, "order.cancelled", id);
        await EnqueueJob(db, tx, "email:order:" + id + ":cancelled", "email", new EmailJob(order.Email, "order-cancelled", Text: "Order " + order.OrderNumber + "\nOrder cancelled. " + request.Reason.Trim()));
        await tx.CommitAsync();
    }
}
