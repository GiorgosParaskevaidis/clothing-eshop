using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Dapper;
using MySqlConnector;

namespace Thesamenot.Api;

public sealed class StoreDatabase(IConfiguration configuration) {
    public async Task<MySqlConnection> Open() {
        var value = configuration.GetConnectionString("Store");
        if (string.IsNullOrWhiteSpace(value)) throw new StoreException(503, "The store is temporarily unavailable.");
        var connection = new MySqlConnection(value);
        await connection.OpenAsync();
        return connection;
    }
    public async Task Initialize(string root) {
        await using var db = await Open();
        var sql = await File.ReadAllTextAsync(Path.Combine(root,"Database","schema.sql"));
        await db.ExecuteAsync(sql);
    }
    public async Task<List<Product>> Products(bool includeInactive = false) {
        await using var db = await Open();
        var products = (await db.QueryAsync<Product>("SELECT * FROM products WHERE active=TRUE OR @includeInactive ORDER BY id DESC",new { includeInactive })).ToList();
        var variants = (await db.QueryAsync<Variant>("SELECT * FROM variants ORDER BY FIELD(size,'S','M','L','XL')")).ToList();
        foreach(var p in products) p.Variants = variants.Where(v=>v.ProductId==p.Id).ToList();
        return products;
    }
    public async Task<Order?> Find(string requestKey) {
        await using var db = await Open();
        return await Load(db,"request_key",requestKey);
    }
    public async Task<Order?> PublicOrder(string token) {
        await using var db = await Open();
        return await Load(db,"public_token",token);
    }
    private static async Task<Order?> Load(MySqlConnection db, string column, string value) {
        // column is an internal constant, never supplied by a caller or an HTTP request.
        var order = await db.QuerySingleOrDefaultAsync<Order>($"SELECT * FROM orders WHERE {column}=@value",new { value });
        if(order is not null) order.Items = (await db.QueryAsync<OrderItem>("SELECT * FROM order_items WHERE order_id=@Id",order)).ToList();
        return order;
    }
    public static string Hash(CheckoutRequest request) {
        var canonical = request with { Items=request.Items.OrderBy(x=>x.VariantId,StringComparer.Ordinal).ToList() };
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(canonical))));
    }
    public async Task<Order> Reserve(CheckoutRequest request, StoreOptions options) {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        var order = new Order {
            Id=Guid.NewGuid().ToString("N"), PublicToken=Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant(),
            RequestKey=request.RequestKey, PayloadHash=Hash(request), Email=request.Email.Trim().ToLowerInvariant(), Name=request.Name.Trim(),
            Address=request.Address.Trim(), City=request.City.Trim(), PostalCode=request.PostalCode.Trim(), Country=request.Country,
            PaymentMode=options.PaymentMode, CreatedUtc=DateTime.UtcNow, ExpiresUtc=DateTime.UtcNow.AddMinutes(35)
        };
        // Reserve rows in a consistent order to avoid deadlocks between overlapping baskets.
        foreach(var line in request.Items.OrderBy(x=>x.VariantId,StringComparer.Ordinal)) {
            var item = await db.QuerySingleOrDefaultAsync<OrderItem>("""
                SELECT v.id variant_id,p.name product_name,v.size,p.price_cents unit_price_cents
                FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=@VariantId AND p.active=TRUE FOR UPDATE
                """,line,tx);
            if(item is null) throw new StoreException(409,"A selected piece is no longer available.");
            var changed = await db.ExecuteAsync("UPDATE variants SET available=available-@Quantity,version=version+1 WHERE id=@VariantId AND available>=@Quantity",line,tx);
            if(changed!=1) throw new StoreException(409,$"Not enough stock for {item.ProductName}, size {item.Size}.");
            item.Quantity=line.Quantity; order.Items.Add(item);
            order.SubtotalCents=checked(order.SubtotalCents+item.UnitPriceCents*line.Quantity);
        }
        order.ShippingCents=order.SubtotalCents>=options.FreeShippingThresholdCents?0:options.ShippingCents;
        order.TotalCents=checked(order.SubtotalCents+order.ShippingCents);
        await db.ExecuteAsync("""
            INSERT INTO orders (id,public_token,request_key,payload_hash,email,name,address,city,postal_code,country,status,payment_mode,subtotal_cents,shipping_cents,total_cents,created_utc,expires_utc)
            VALUES (@Id,@PublicToken,@RequestKey,@PayloadHash,@Email,@Name,@Address,@City,@PostalCode,@Country,@Status,@PaymentMode,@SubtotalCents,@ShippingCents,@TotalCents,@CreatedUtc,@ExpiresUtc)
            """,order,tx);
        foreach(var item in order.Items) await db.ExecuteAsync("""
            INSERT INTO order_items (order_id,variant_id,product_name,size,quantity,unit_price_cents)
            VALUES (@OrderId,@VariantId,@ProductName,@Size,@Quantity,@UnitPriceCents)
            """,new {OrderId=order.Id,item.VariantId,item.ProductName,item.Size,item.Quantity,item.UnitPriceCents},tx);
        await tx.CommitAsync();
        return order;
    }
    public async Task AttachSession(Order order,string? sessionId,string url) {
        await using var db=await Open();
        await db.ExecuteAsync("UPDATE orders SET stripe_session_id=@sessionId,checkout_url=@url WHERE id=@Id AND status='pending'",new {order.Id,sessionId,url});
        order.StripeSessionId=sessionId; order.CheckoutUrl=url;
    }
    public async Task Transition(string orderId,string target,string? eventId=null,string? stripeSessionId=null,int? paidAmount=null) {
        await using var db=await Open();
        await using var tx=await db.BeginTransactionAsync();
        var order=await db.QuerySingleOrDefaultAsync<Order>("SELECT * FROM orders WHERE id=@orderId FOR UPDATE",new {orderId},tx);
        if(order is null) throw new StoreException(404,"Order not found.");
        if(stripeSessionId is not null && (order.StripeSessionId!=stripeSessionId || order.PaymentMode!="Stripe")) throw new StoreException(400,"Payment session does not match the order.");
        if(paidAmount is not null && order.TotalCents!=paidAmount) throw new StoreException(400,"Payment total does not match the order.");
        if(eventId is not null && await db.ExecuteAsync("INSERT IGNORE INTO payment_events VALUES (@eventId,UTC_TIMESTAMP(6))",new {eventId},tx)==0) { await tx.CommitAsync(); return; }
        if(order.Status=="pending") {
            if(target=="expired") {
                var lines=await db.QueryAsync<OrderItem>("SELECT * FROM order_items WHERE order_id=@orderId ORDER BY variant_id",new {orderId},tx);
                foreach(var line in lines) await db.ExecuteAsync("UPDATE variants SET available=available+@Quantity,version=version+1 WHERE id=@VariantId",line,tx);
            }
            await db.ExecuteAsync("UPDATE orders SET status=@target WHERE id=@orderId",new {target,orderId},tx);
        }
        await tx.CommitAsync();
    }
    public async Task<List<Order>> Orders() {
        await using var db=await Open();
        var orders=(await db.QueryAsync<Order>("SELECT * FROM orders ORDER BY created_utc DESC LIMIT 200")).ToList();
        foreach(var order in orders) order.Items=(await db.QueryAsync<OrderItem>("SELECT * FROM order_items WHERE order_id=@Id",order)).ToList();
        return orders;
    }
    public async Task<List<Order>> Expiring() {
        await using var db=await Open();
        return (await db.QueryAsync<Order>("SELECT * FROM orders WHERE status='pending' AND expires_utc<UTC_TIMESTAMP(6) LIMIT 100")).ToList();
    }
    public async Task UpdateProduct(string id,ProductUpdate value) {
        await using var db=await Open();
        if(await db.ExecuteAsync("UPDATE products SET name=@Name,description=@Description,price_cents=@PriceCents,active=@Active WHERE id=@id",new {id,value.Name,value.Description,value.PriceCents,value.Active})!=1) throw new StoreException(404,"Product not found.");
    }
    public async Task UpdateStock(string id,StockUpdate value) {
        await using var db=await Open();
        await using var tx=await db.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        var variant=await db.QuerySingleOrDefaultAsync<Variant>("SELECT * FROM variants WHERE id=@id FOR UPDATE",new {id},tx);
        if(variant is null || variant.Version!=value.Version) throw new StoreException(409,"Stock changed. Refresh and try again.");
        var edition=await db.ExecuteScalarAsync<int>("SELECT edition FROM products WHERE id=@ProductId FOR UPDATE",variant,tx);
        if(value.Available>variant.Available) {
            var remaining=await db.ExecuteScalarAsync<int>("SELECT COALESCE(SUM(available),0) FROM variants WHERE product_id=@ProductId",variant,tx);
            var committed=await db.ExecuteScalarAsync<int>("""
                SELECT COALESCE(SUM(i.quantity),0) FROM order_items i
                JOIN orders o ON o.id=i.order_id JOIN variants v ON v.id=i.variant_id
                WHERE v.product_id=@ProductId AND o.status IN ('pending','paid','fulfilled')
                """,variant,tx);
            if(remaining+committed+value.Available-variant.Available>edition) throw new StoreException(409,"Available, reserved and sold units cannot exceed this limited edition. Reduce another size first if reallocating stock.");
        }
        await db.ExecuteAsync("UPDATE variants SET available=@Available,version=version+1 WHERE id=@id AND version=@Version",new {id,value.Available,value.Version},tx);
        await tx.CommitAsync();
    }
    public async Task Subscribe(NewsletterRequest request) {
        await using var db=await Open();
        await db.ExecuteAsync("INSERT IGNORE INTO subscribers VALUES (@Email,UTC_TIMESTAMP(6),'newsletter-v1',@token)",new {Email=request.Email.Trim().ToLowerInvariant(),token=Convert.ToHexString(RandomNumberGenerator.GetBytes(32))});
    }
    public async Task<object> Subscribers() {
        await using var db=await Open();
        return await db.QueryAsync("SELECT email,consent_utc consentUtc,consent_version consentVersion FROM subscribers ORDER BY consent_utc DESC LIMIT 500");
    }
    public async Task Unsubscribe(string token) {
        await using var db=await Open();
        await db.ExecuteAsync("DELETE FROM subscribers WHERE unsubscribe_token=@token",new {token});
    }
}
