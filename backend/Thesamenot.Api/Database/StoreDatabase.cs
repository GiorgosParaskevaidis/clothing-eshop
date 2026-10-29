using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Dapper;
using MySqlConnector;
using Microsoft.AspNetCore.DataProtection;

namespace Thesamenot.Api;

public sealed partial class StoreDatabase(IConfiguration configuration, IDataProtectionProvider? protection = null)
{
    public async Task<MySqlConnection> Open()
    {
        var connection = StoreConnectionFactory.Create(configuration);
        await connection.OpenAsync();
        return connection;
    }
    public async Task<string?> ServerVersion()
    {
        await using var db = await Open();
        return await db.ExecuteScalarAsync<string>("SELECT VERSION()");
    }

    public async Task FulfillOrder(string id)
    {
        await Task.CompletedTask;
        throw new StoreException(409, "Use the shipping form to record courier and tracking details.");
    }

    public async Task<List<Product>> Products(bool includeInactive = false)
    {
        return (await Catalog(new CatalogQuery(PageSize: 24), includeInactive)).Items.ToList();
    }
    public async Task<Order?> Find(string requestKey, CheckoutOwner owner)
    {
        await using var db = await Open();
        return await Load(db, "request_key", ScopedRequestKey(requestKey, owner));
    }
    public async Task<Order?> PublicOrder(string token)
    {
        await using var db = await Open();
        return await Load(db, "public_token", token);
    }
    private static async Task<Order?> Load(MySqlConnection db, string column, string value)
    {
        // column is an internal constant, never supplied by a caller or an HTTP request.
        var order = await db.QuerySingleOrDefaultAsync<Order>($"SELECT * FROM orders WHERE {column}=@value", new { value });
        if (order is not null) order.Items = (await db.QueryAsync<OrderItem>("SELECT * FROM order_items WHERE order_id=@Id ORDER BY variant_id,id", order)).ToList();
        return order;
    }
    public static string Hash(CheckoutRequest request)
    {
        var canonical = request with { QuoteId = null, Items = request.Items.OrderBy(x => x.VariantId, StringComparer.Ordinal).ToList() };
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(canonical))));
    }
    public static string ScopedRequestKey(string key, CheckoutOwner owner) => SecretHash(owner.Key + "\n" + key);
    public async Task<Order> Reserve(CheckoutRequest request, StoreOptions options, CheckoutOwner owner, bool manual = false)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        // Serialize availability and recipient selection with admin changes, before touching stock.
        var paymentSettings = manual && request.PaymentMethod == ManualPaymentMethods.BankTransfer
            ? await ReadPaymentSettings(db, tx) : null;
        if (paymentSettings is not null && !ManualPaymentMethods.BankReady(paymentSettings))
            throw new StoreException(503, "Bank transfer is currently unavailable. Please choose cash on delivery.");
        var notificationEmail = manual ? await OrderNotificationEmail(db, tx) : null;
        var shipping = await db.QuerySingleAsync<ShippingSettings>("SELECT * FROM shipping_settings WHERE id=1 LOCK IN SHARE MODE", transaction: tx);
        var quote = await db.QuerySingleOrDefaultAsync<CheckoutQuote>("SELECT * FROM checkout_quotes WHERE id=@QuoteId AND owner_key=@Key FOR UPDATE", new { request.QuoteId, owner.Key }, tx);
        var taxProfile = Services.TaxCalculator.Read(configuration);
        if (!shipping.Enabled || quote is null || quote.CommercialHash != Services.LegalPolicies.Fingerprint(configuration, taxProfile) || quote.ExpiresUtc < DateTime.UtcNow || quote.CartHash != CartHash(request.Items, request.Country) || quote.ShippingVersion != shipping.Version)
            throw new StoreException(409, "Your checkout quote changed or expired. Review the new total and confirm again.");
        var order = new Order
        {
            Id = Guid.NewGuid().ToString("N"),
            PublicToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant(),
            RequestKey = ScopedRequestKey(request.RequestKey, owner),
            CheckoutOwner = owner.Key,
            UserId = owner.UserId,
            PayloadHash = Hash(request),
            Email = request.Email.Trim().ToLowerInvariant(),
            Name = request.Name.Trim(),
            Phone = request.Phone.Trim(),
            Address = request.Address.Trim(),
            City = request.City.Trim(),
            PostalCode = request.PostalCode.Trim(),
            Country = request.Country,
            PaymentMode = manual ? request.PaymentMethod : options.PaymentMode,
            Status = manual ? request.PaymentMethod == ManualPaymentMethods.BankTransfer ? "awaiting_payment" : "confirmed" : "pending",
            ReservationStatus = manual && request.PaymentMethod == ManualPaymentMethods.CashOnDelivery ? "consumed" : "active",
            CreatedUtc = DateTime.UtcNow,
            ExpiresUtc = DateTime.UtcNow.AddMinutes(35),
            Currency = shipping.Currency,
            ShippingMethod = shipping.MethodName,
            ShippingVersion = shipping.Version,
            QuoteId = quote.Id,
            TermsVersion = configuration["Merchant:TermsVersion"] ?? "demo-terms-v1"
        };
        order.OrderNumber = "TSN-" + order.Id[..16].ToUpperInvariant();
        // Every catalog/stock mutation locks products before variants, in stable order.
        await db.QueryAsync<string>("SELECT id FROM products WHERE id IN (SELECT product_id FROM variants WHERE id IN @ids) ORDER BY id FOR UPDATE",
            new { ids = request.Items.Select(i => i.VariantId).ToArray() }, tx);
        var prices = (await db.QueryAsync<QuoteLine>("SELECT v.id,p.price_cents,p.version FROM products p JOIN variants v ON v.product_id=p.id WHERE v.id IN @ids ORDER BY p.id,v.id", new { ids = request.Items.Select(i => i.VariantId).ToArray() }, tx)).ToList();
        if (PriceHash(prices) != quote.PriceHash) throw new StoreException(409, "Prices changed. Review the new total and confirm again.");
        // Reserve rows in a consistent order to avoid deadlocks between overlapping baskets.
        foreach (var line in request.Items.OrderBy(x => x.VariantId, StringComparer.Ordinal))
        {
            var item = await db.QuerySingleOrDefaultAsync<OrderItem>("""
                SELECT v.id variant_id,p.name product_name,v.size,p.price_cents unit_price_cents,p.slug product_slug,v.sku,v.color,
                  COALESCE((SELECT CONCAT('/api/media/',storage_key) FROM product_images WHERE product_id=p.id ORDER BY position,id LIMIT 1),p.front_image) image_url
                FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=@VariantId AND v.active AND p.active AND p.status='published' FOR UPDATE
                """, line, tx);
            if (item is null) throw new StoreException(409, "A selected piece is no longer available.");
            var changed = await db.ExecuteAsync("UPDATE variants SET available=available-@Quantity,version=version+1 WHERE id=@VariantId AND available>=@Quantity", line, tx);
            if (changed != 1) throw new StoreException(409, $"Not enough stock for {item.ProductName}, size {item.Size}.");
            item.Quantity = line.Quantity; order.Items.Add(item);
            order.SubtotalCents = checked(order.SubtotalCents + item.UnitPriceCents * line.Quantity);
        }
        order.ShippingCents = shipping.FreeFromCents.HasValue && order.SubtotalCents >= shipping.FreeFromCents ? 0 : shipping.CostCents;
        order.TotalCents = checked(order.SubtotalCents + order.ShippingCents);
        var taxes = Services.TaxCalculator.Calculate(order.TotalCents, taxProfile);
        order.NetCents = taxes.NetCents; order.TaxCents = taxes.TaxCents; order.TaxSnapshot = taxes.Snapshot; order.TaxPolicyVersion = taxProfile.Version;
        order.ShippingPolicyVersion = configuration["Merchant:ShippingPolicyVersion"] ?? "demo-shipping-v1";
        order.PrivacyVersion = configuration["Merchant:PrivacyVersion"] ?? "demo-privacy-v1";
        order.ReturnsPolicyVersion = configuration["Merchant:ReturnsVersion"] ?? "demo-returns-v1";
        var policies = Services.LegalPolicies.All(configuration);
        if (manual) policies = [..policies, new Services.LegalPolicies.Policy("payment", "Payment instructions", ManualPaymentMethods.Instructions(order, paymentSettings), "manual-payments-v1", true)];
        order.PolicySnapshot = JsonSerializer.Serialize(policies);
        order.TermsVersion = policies.Single(policy => policy.Slug == "terms").Version;
        order.ShippingPolicyVersion = policies.Single(policy => policy.Slug == "shipping").Version;
        order.PrivacyVersion = policies.Single(policy => policy.Slug == "privacy").Version;
        order.ReturnsPolicyVersion = policies.Single(policy => policy.Slug == "returns").Version;
        await db.ExecuteAsync("""
            INSERT INTO orders (id,public_token,request_key,payload_hash,email,name,address,city,postal_code,country,status,payment_mode,subtotal_cents,shipping_cents,total_cents,created_utc,expires_utc,user_id,checkout_owner,order_number,phone,currency,shipping_method,shipping_version,quote_id,terms_version,terms_accepted_utc)
            VALUES (@Id,@PublicToken,@RequestKey,@PayloadHash,@Email,@Name,@Address,@City,@PostalCode,@Country,@Status,@PaymentMode,@SubtotalCents,@ShippingCents,@TotalCents,@CreatedUtc,@ExpiresUtc,@UserId,@CheckoutOwner,@OrderNumber,@Phone,@Currency,@ShippingMethod,@ShippingVersion,@QuoteId,@TermsVersion,UTC_TIMESTAMP(6))
            """, order, tx);
        await db.ExecuteAsync("""
            UPDATE orders SET net_cents=@NetCents,tax_cents=@TaxCents,tax_snapshot=@TaxSnapshot,tax_policy_version=@TaxPolicyVersion,
              terms_version=@TermsVersion,shipping_policy_version=@ShippingPolicyVersion,privacy_version=@PrivacyVersion,returns_policy_version=@ReturnsPolicyVersion,policy_snapshot=@PolicySnapshot,reservation_status=@ReservationStatus WHERE id=@Id
            """, order, tx);
        foreach (var item in order.Items) await db.ExecuteAsync("""
            INSERT INTO order_items (order_id,variant_id,product_name,size,quantity,unit_price_cents,product_slug,sku,color,image_url)
            VALUES (@OrderId,@VariantId,@ProductName,@Size,@Quantity,@UnitPriceCents,@ProductSlug,@Sku,@Color,@ImageUrl)
            """, new { OrderId = order.Id, item.VariantId, item.ProductName, item.Size, item.Quantity, item.UnitPriceCents, item.ProductSlug, item.Sku, item.Color, item.ImageUrl }, tx);
        foreach (var item in order.Items)
        {
            await db.ExecuteAsync("INSERT INTO order_reservations(order_id,variant_id,quantity,state,expires_utc) VALUES(@Id,@VariantId,@Quantity,@ReservationStatus,@ExpiresUtc)", new { order.Id, item.VariantId, item.Quantity, order.ReservationStatus, order.ExpiresUtc }, tx);
            await db.ExecuteAsync("INSERT INTO inventory_movements(variant_id,order_id,delta,reason,actor) VALUES(@VariantId,@Id,@delta,'Checkout reservation','system')", new { item.VariantId, order.Id, delta = -item.Quantity }, tx);
        }
        await db.ExecuteAsync("INSERT INTO payment_attempts(order_id,expected_cents,currency,state) VALUES(@Id,@TotalCents,@Currency,'pending')", order, tx);
        await History(db, tx, order.Id, "order.created", "Checkout reservation created.");
        if (manual) await EnqueueOrderEmails(db, tx, order, notificationEmail!);
        await tx.CommitAsync();
        return order;
    }
    public async Task AttachSession(Order order, string? sessionId, string url)
    {
        await using var db = await Open();
        await db.ExecuteAsync("UPDATE orders SET stripe_session_id=@sessionId,checkout_url=@url WHERE id=@Id AND status='pending'", new { order.Id, sessionId, url });
        await db.ExecuteAsync("UPDATE payment_attempts SET provider_session=@sessionId,updated_utc=UTC_TIMESTAMP(6) WHERE order_id=@Id", new { order.Id, sessionId });
        order.StripeSessionId = sessionId; order.CheckoutUrl = url;
    }
    public async Task Transition(string orderId, string target, string? eventId = null, string? stripeSessionId = null, int? paidAmount = null)
    {
        if (target is not ("paid" or "expired")) throw new InvalidOperationException("Invalid payment transition.");
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleOrDefaultAsync<Order>("SELECT * FROM orders WHERE id=@orderId FOR UPDATE", new { orderId }, tx);
        if (order is null) throw new StoreException(404, "Order not found.");
        if (stripeSessionId is not null && (order.StripeSessionId != stripeSessionId || order.PaymentMode != "Stripe")) throw new StoreException(400, "Payment session does not match the order.");
        if (paidAmount is not null && order.TotalCents != paidAmount)
        {
            await db.ExecuteAsync("INSERT IGNORE INTO payment_incidents(order_id,event_id,reason,amount_cents,currency) VALUES(@orderId,@eventId,'amount_mismatch',@paidAmount,'EUR')", new { orderId, eventId = eventId ?? "reconcile:" + orderId, paidAmount }, tx);
            await tx.CommitAsync(); throw new StoreException(400, "Payment total does not match the order.");
        }
        if (eventId is not null && await db.ExecuteAsync("INSERT IGNORE INTO payment_events VALUES (@eventId,UTC_TIMESTAMP(6))", new { eventId }, tx) == 0) { await tx.CommitAsync(); return; }
        var receivedAlready = await db.ExecuteScalarAsync<bool>("SELECT state='succeeded' FROM payment_attempts WHERE order_id=@orderId", new { orderId }, tx);
        if (order.Status == "pending" || (target == "paid" && order.ReservationStatus == "released" && !receivedAlready))
        {
            var late = target == "paid" && order.ReservationStatus == "released";
            if (target == "expired")
            {
                var lines = await db.QueryAsync<OrderItem>("SELECT * FROM order_items WHERE order_id=@orderId ORDER BY variant_id", new { orderId }, tx);
                await db.QueryAsync<string>("SELECT id FROM products WHERE id IN (SELECT v.product_id FROM variants v JOIN order_items i ON i.variant_id=v.id WHERE i.order_id=@orderId) ORDER BY id FOR UPDATE", new { orderId }, tx);
                foreach (var line in lines)
                {
                    await db.ExecuteAsync("UPDATE variants SET available=available+@Quantity,version=version+1 WHERE id=@VariantId", line, tx);
                    await db.ExecuteAsync("INSERT INTO inventory_movements(variant_id,order_id,delta,reason,actor) VALUES(@VariantId,@orderId,@Quantity,'Reservation released','system')", new { line.VariantId, line.Quantity, orderId }, tx);
                }
            }
            var state = late ? "payment_exception" : target;
            var reservation = target == "expired" ? "released" : late ? "released" : "consumed";
            var refunded = await db.ExecuteScalarAsync<int>("SELECT COALESCE(SUM(amount_cents),0) FROM refunds WHERE order_id=@orderId AND state='succeeded'", new { orderId }, tx);
            var payment = refunded >= order.TotalCents ? "refunded" : refunded > 0 ? "partially_refunded" : target == "paid" ? "succeeded" : "unpaid";
            await db.ExecuteAsync("UPDATE orders SET status=@state,payment_status=@payment,reservation_status=@reservation,version=version+1 WHERE id=@orderId", new { state, payment, reservation, orderId }, tx);
            await db.ExecuteAsync("UPDATE order_reservations SET state=@reservation WHERE order_id=@orderId", new { reservation, orderId }, tx);
            await db.ExecuteAsync("UPDATE payment_attempts SET state=@state,received_cents=@amount,updated_utc=UTC_TIMESTAMP(6) WHERE order_id=@orderId", new { state = target == "paid" ? "succeeded" : "unpaid", amount = target == "paid" ? order.TotalCents : 0, orderId }, tx);
            await History(db, tx, orderId, late ? "payment.late" : target == "paid" ? "payment.succeeded" : "reservation.expired", late ? "Payment received after stock was released. Fulfillment is blocked pending review/refund." : target == "paid" ? "Payment confirmed." : "Reservation released.");
            if (late) await db.ExecuteAsync("INSERT IGNORE INTO payment_incidents(order_id,event_id,reason,amount_cents,currency) VALUES(@orderId,@eventId,'late_payment',@TotalCents,@Currency)", new { orderId, eventId = eventId ?? "late:" + orderId, order.TotalCents, order.Currency }, tx);
            await EnqueueJob(db, tx, "email:order:" + orderId + ":" + state, "email", new EmailJob(order.Email, "order-" + state, Text: "Order " + order.OrderNumber + "\n" + (late ? "Payment received. The store is reviewing your order before fulfillment." : target == "paid" ? "Payment confirmed." : "Your checkout reservation expired.") + "\nTotal: " + (order.TotalCents / 100m).ToString("0.00", System.Globalization.CultureInfo.InvariantCulture) + " " + order.Currency));
        }
        await tx.CommitAsync();
    }
    public async Task<List<Order>> Orders()
    {
        await using var db = await Open();
        var orders = (await db.QueryAsync<Order>("SELECT * FROM orders ORDER BY created_utc DESC LIMIT 200")).ToList();
        if (orders.Count > 0)
        {
            var items = await db.QueryAsync("SELECT * FROM order_items WHERE order_id IN @ids ORDER BY id", new { ids = orders.Select(o => o.Id).ToArray() });
            foreach (var order in orders) order.Items = items.Where(item => (string)item.order_id == order.Id).Select(item => new OrderItem
            {
                Id = item.id,
                VariantId = item.variant_id,
                ProductName = item.product_name,
                Size = item.size,
                Quantity = item.quantity,
                UnitPriceCents = item.unit_price_cents,
                ProductSlug = item.product_slug,
                Sku = item.sku,
                Color = item.color,
                ImageUrl = item.image_url
            }).ToList();
        }
        return orders;
    }
    public async Task<List<Order>> Expiring()
    {
        await using var db = await Open();
        return (await db.QueryAsync<Order>("SELECT * FROM orders WHERE status='pending' AND expires_utc<UTC_TIMESTAMP(6) LIMIT 100")).ToList();
    }
    public async Task UpdateProduct(string id, ProductUpdate value)
    {
        await using var db = await Open();
        // Compatibility editor can update existing copy/price or archive. Publishing uses the validated catalog workflow.
        if (value.Version is null) throw new StoreException(409, "Refresh the product before saving.");
        if (await db.ExecuteAsync("""
            UPDATE products SET name=@Name,description=@Description,price_cents=@PriceCents,
              active=@Active,status=IF(@Active,status,'archived'),version=version+1,updated_utc=UTC_TIMESTAMP(6)
            WHERE id=@id AND version=@Version AND (NOT @Active OR status='published')
            """, new { id, value.Name, value.Description, value.PriceCents, value.Active, value.Version }) != 1) throw new StoreException(409, "Product changed. Use the product editor to publish it.");
    }
    public async Task UpdateStock(string id, StockUpdate value, string actor = "legacy-admin")
    {
        if (string.IsNullOrWhiteSpace(value.Reason) || value.Reason.Length > 300) throw new StoreException(400, "A stock adjustment reason is required.");
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        var productId = await db.ExecuteScalarAsync<string>("SELECT product_id FROM variants WHERE id=@id", new { id }, tx);
        if (productId is null) throw new StoreException(404, "Variant not found.");
        var product = await db.QuerySingleAsync<Product>("SELECT * FROM products WHERE id=@productId FOR UPDATE", new { productId }, tx);
        var variant = await db.QuerySingleOrDefaultAsync<Variant>("SELECT * FROM variants WHERE id=@id FOR UPDATE", new { id }, tx);
        if (variant is null || variant.Version != value.Version) throw new StoreException(409, "Stock changed. Refresh and try again.");
        if (product.InventoryMode == "limited" && value.Available > variant.Available)
        {
            var remaining = await db.ExecuteScalarAsync<int>("SELECT COALESCE(SUM(available),0) FROM variants WHERE product_id=@ProductId", variant, tx);
            var committed = await db.ExecuteScalarAsync<int>("""
                SELECT COALESCE(SUM(i.quantity-COALESCE((SELECT SUM(ri.restocked_quantity) FROM return_items ri WHERE ri.order_item_id=i.id),0)),0) FROM order_items i
                JOIN orders o ON o.id=i.order_id JOIN variants v ON v.id=i.variant_id
                WHERE v.product_id=@ProductId AND o.status IN ('pending','awaiting_payment','confirmed','paid','fulfilled')
                """, variant, tx);
            if (remaining + committed + value.Available - variant.Available > product.Edition) throw new StoreException(409, "Available, reserved and sold units cannot exceed this limited edition. Reduce another size first if reallocating stock.");
        }
        await db.ExecuteAsync("UPDATE variants SET available=@Available,version=version+1 WHERE id=@id AND version=@Version", new { id, value.Available, value.Version }, tx);
        await db.ExecuteAsync("INSERT INTO inventory_movements(variant_id,delta,reason,actor) VALUES(@id,@delta,@Reason,@actor)", new { id, delta = value.Available - variant.Available, value.Reason, actor }, tx);
        await Audit(db, tx, actor, "stock.adjusted", id);
        await tx.CommitAsync();
    }
    public async Task<object> Subscribers()
    {
        await using var db = await Open();
        return await db.QueryAsync("SELECT email,status,consent_utc consentUtc,consent_version consentVersion,confirmed_utc confirmedUtc,unsubscribed_utc unsubscribedUtc FROM subscribers ORDER BY consent_utc DESC LIMIT 500");
    }
}
