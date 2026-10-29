using Dapper;
using Thesamenot.Api.Security.Identity;

namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    public async Task<CustomerProfile> CustomerProfile(string userId)
    {
        await using var db = await Open();
        return await db.QuerySingleOrDefaultAsync<CustomerProfile>(
            "SELECT id,email,display_name,profile_version version FROM users WHERE id=@userId AND enabled=TRUE", new { userId })
            ?? throw new StoreException(404, "Account not found.");
    }
    public async Task UpdateProfile(string userId, ProfileUpdate value)
    {
        await using var db = await Open();
        if (await db.ExecuteAsync("""
            UPDATE users SET display_name=@name,profile_version=profile_version+1,
              concurrency_stamp=@stamp,updated_utc=UTC_TIMESTAMP(6)
            WHERE id=@userId AND enabled=TRUE AND profile_version=@Version
            """, new { userId, name = value.DisplayName.Trim(), value.Version, stamp = Stamp() }) != 1)
            throw new StoreException(409, "Your profile changed. Refresh and try again.");
    }
    public async Task<List<CustomerAddress>> Addresses(string userId)
    {
        await using var db = await Open();
        return (await db.QueryAsync<CustomerAddress>(
            "SELECT * FROM user_addresses WHERE user_id=@userId ORDER BY is_default DESC,created_utc,id", new { userId })).ToList();
    }
    public async Task<CustomerAddress> SaveAddress(string userId, string? id, AddressUpdate value)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        if (await db.ExecuteScalarAsync<string>("SELECT id FROM users WHERE id=@userId AND enabled=TRUE FOR UPDATE", new { userId }, tx) is null)
            throw new StoreException(404, "Account not found.");
        CustomerAddress? old = null;
        if (id is not null)
        {
            old = await db.QuerySingleOrDefaultAsync<CustomerAddress>(
                "SELECT * FROM user_addresses WHERE id=@id AND user_id=@userId FOR UPDATE", new { id, userId }, tx);
            if (old is null) throw new StoreException(404, "Address not found.");
            if (old.Version != value.Version) throw new StoreException(409, "The address changed. Refresh and try again.");
        }
        var count = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM user_addresses WHERE user_id=@userId", new { userId }, tx);
        if (id is null && count >= 20) throw new StoreException(409, "You can save up to 20 addresses.");
        var addressId = id ?? Stamp();
        var isDefault = value.IsDefault || count == 0;
        if (isDefault)
            await db.ExecuteAsync("""
                UPDATE user_addresses SET is_default=FALSE,version=version+1,updated_utc=UTC_TIMESTAMP(6)
                WHERE user_id=@userId AND id<>@addressId AND is_default=TRUE
                """, new { userId, addressId }, tx);
        var data = new
        {
            id = addressId,
            userId,
            label = value.Label.Trim(),
            name = value.Name.Trim(),
            address = value.Address.Trim(),
            city = value.City.Trim(),
            postalCode = value.PostalCode.Trim(),
            value.Country,
            phone = value.Phone.Trim(),
            isDefault,
            value.Version
        };
        if (old is null)
            await db.ExecuteAsync("""
                INSERT INTO user_addresses(id,user_id,label,name,address,city,postal_code,country,phone,is_default,created_utc,updated_utc)
                VALUES(@id,@userId,@label,@name,@address,@city,@postalCode,@Country,@phone,@isDefault,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))
                """, data, tx);
        else
            await db.ExecuteAsync("""
                UPDATE user_addresses SET label=@label,name=@name,address=@address,city=@city,postal_code=@postalCode,
                  country=@Country,phone=@phone,is_default=@isDefault,version=version+1,updated_utc=UTC_TIMESTAMP(6)
                WHERE id=@id AND user_id=@userId AND version=@Version
                """, data, tx);
        await tx.CommitAsync();
        return await db.QuerySingleAsync<CustomerAddress>("SELECT * FROM user_addresses WHERE id=@addressId AND user_id=@userId", new { addressId, userId });
    }
    public async Task DeleteAddress(string userId, string id, int version)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        await db.ExecuteScalarAsync<string>("SELECT id FROM users WHERE id=@userId FOR UPDATE", new { userId }, tx);
        var address = await db.QuerySingleOrDefaultAsync<CustomerAddress>(
            "SELECT * FROM user_addresses WHERE id=@id AND user_id=@userId FOR UPDATE", new { id, userId }, tx)
            ?? throw new StoreException(404, "Address not found.");
        if (address.Version != version) throw new StoreException(409, "The address changed. Refresh and try again.");
        await db.ExecuteAsync("DELETE FROM user_addresses WHERE id=@id AND user_id=@userId", new { id, userId }, tx);
        if (address.IsDefault)
            await db.ExecuteAsync("""
                UPDATE user_addresses SET is_default=TRUE,version=version+1,updated_utc=UTC_TIMESTAMP(6)
                WHERE user_id=@userId ORDER BY created_utc,id LIMIT 1
                """, new { userId }, tx);
        await tx.CommitAsync();
    }
    public async Task<PageResult<object>> CustomerOrders(string userId, int page, int size)
    {
        await using var db = await Open();
        var total = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM orders WHERE user_id=@userId", new { userId });
        var rows = await db.QueryAsync<Order>("SELECT * FROM orders WHERE user_id=@userId ORDER BY created_utc DESC,id DESC LIMIT @size OFFSET @offset",
            new { userId, size, offset = (page - 1) * size });
        return new(rows.Select(order => (object)new { order.Id, number = order.OrderNumber, order.Status, order.TotalCents, order.CreatedUtc }).ToList(), page, size, total);
    }
    public async Task<Order> CustomerOrder(string userId, string id)
    {
        await using var db = await Open();
        var order = await db.QuerySingleOrDefaultAsync<Order>("SELECT * FROM orders WHERE id=@id AND user_id=@userId", new { id, userId })
            ?? throw new StoreException(404, "Order not found.");
        order.Items = (await db.QueryAsync<OrderItem>("SELECT * FROM order_items WHERE order_id=@id ORDER BY id", new { id })).ToList();
        return order;
    }
    public async Task<string?> IssueOrderAccess(OrderLinkRequest request)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleOrDefaultAsync<Order>("""
            SELECT * FROM orders WHERE order_number=@number AND email COLLATE utf8mb4_bin=@email AND user_id IS NULL FOR UPDATE
            """, new { number = request.OrderNumber.Trim().ToUpperInvariant(), email = request.Email }, tx);
        if (order is null) return null;
        // Reissuing a link also revokes previously exchanged access grants.
        await db.ExecuteAsync("UPDATE order_access_tokens SET revoked_utc=UTC_TIMESTAMP(6) WHERE order_id=@Id AND purpose=@Purpose AND revoked_utc IS NULL",
            new { order.Id, request.Purpose }, tx);
        var token = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
        await db.ExecuteAsync("""
            INSERT INTO order_access_tokens(id,order_id,purpose,token_hash,expires_utc,created_utc)
            VALUES(@id,@orderId,@Purpose,@hash,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE),UTC_TIMESTAMP(6))
            """, new { id = Stamp(), orderId = order.Id, request.Purpose, hash = SecretHash(token) }, tx);
        await EnqueueJob(db, tx, "email:guest:" + SecretHash(token), "email", new EmailJob(order.Email, "order-" + request.Purpose, token));
        await tx.CommitAsync();
        return token;
    }
    private sealed class GuestAction
    {
        public string Id { get; set; } = "";
        public string OrderId { get; set; } = "";
        public string Purpose { get; set; } = "";
    }
    public async Task<OrderAccessGrant> CompleteOrderAccess(string token, string purpose, string? userId)
    {
        await using var db = await Open();
        var hash = SecretHash(token);
        var candidate = await db.QuerySingleOrDefaultAsync<GuestAction>(
            "SELECT id,order_id,purpose FROM order_access_tokens WHERE token_hash=@hash AND purpose=@purpose", new { hash, purpose });
        if (candidate is null) throw new StoreException(400, "Invalid or expired order link.");
        await using var tx = await db.BeginTransactionAsync();
        var order = await db.QuerySingleOrDefaultAsync<Order>("SELECT * FROM orders WHERE id=@OrderId FOR UPDATE", candidate, tx);
        var action = await db.QuerySingleOrDefaultAsync<GuestAction>("""
            SELECT id,order_id,purpose FROM order_access_tokens WHERE token_hash=@hash AND purpose=@purpose
              AND used_utc IS NULL AND revoked_utc IS NULL AND expires_utc>UTC_TIMESTAMP(6) FOR UPDATE
            """, new { hash, purpose }, tx);
        if (action is null || order is null || order.UserId is not null) throw new StoreException(400, "Invalid or expired order link.");
        if (purpose == "claim")
        {
            var user = await db.QuerySingleOrDefaultAsync<StoreUser>("SELECT * FROM users WHERE id=@userId FOR UPDATE", new { userId }, tx);
            if (user is null || !user.Enabled || !user.EmailConfirmed || !string.Equals(user.Email, order.Email, StringComparison.OrdinalIgnoreCase))
                throw new StoreException(400, "The verified account must match the order email.");
            await db.ExecuteAsync("UPDATE orders SET user_id=@userId,version=version+1 WHERE id=@Id AND user_id IS NULL", new { userId, order.Id }, tx);
            await db.ExecuteAsync("UPDATE order_access_tokens SET revoked_utc=UTC_TIMESTAMP(6) WHERE order_id=@Id", order, tx);
            await Audit(db, tx, userId, "order.claimed", order.Id);
        }
        await db.ExecuteAsync("UPDATE order_access_tokens SET used_utc=UTC_TIMESTAMP(6) WHERE id=@Id", action, tx);
        await tx.CommitAsync();
        return new() { Id = action.Id, OrderId = order.Id };
    }
    public async Task<Order> GuestOrder(string grantId, string orderId)
    {
        await using var db = await Open();
        var order = await db.QuerySingleOrDefaultAsync<Order>("""
            SELECT o.* FROM orders o JOIN order_access_tokens t ON t.order_id=o.id
            WHERE t.id=@grantId AND o.id=@orderId AND t.purpose='access' AND t.used_utc IS NOT NULL
              AND t.revoked_utc IS NULL AND t.expires_utc>UTC_TIMESTAMP(6) AND o.user_id IS NULL
            """, new { grantId, orderId }) ?? throw new StoreException(401, "Order access expired. Request a new link.");
        order.Items = (await db.QueryAsync<OrderItem>("SELECT * FROM order_items WHERE order_id=@orderId ORDER BY id", new { orderId })).ToList();
        return order;
    }
}
