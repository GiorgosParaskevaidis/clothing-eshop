using Dapper;

namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    public sealed class CustomerAdminRow
    {
        public string Id { get; set; } = "";
        public string Email { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public bool Enabled { get; set; }
        public bool EmailConfirmed { get; set; }
        public DateTime CreatedUtc { get; set; }
    }
    public async Task<PageResult<CustomerAdminRow>> Customers(int page, int size, string? query)
    {
        await using var db = await Open();
        var search = "%" + (query ?? "").Trim().Replace("!", "!!").Replace("%", "!%").Replace("_", "!_") + "%";
        const string filter = """
            FROM users u WHERE EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role_id='customer')
              AND (u.email LIKE @search ESCAPE '!' OR u.display_name LIKE @search ESCAPE '!')
            """;
        var total = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) " + filter, new { search });
        var items = (await db.QueryAsync<CustomerAdminRow>(
            "SELECT u.id,u.email,u.display_name,u.enabled,u.email_confirmed,u.created_utc " + filter +
            " ORDER BY u.created_utc DESC,u.id DESC LIMIT @size OFFSET @offset", new { search, size, offset = (page - 1) * size })).ToList();
        return new(items, page, size, total);
    }
    public async Task<CustomerAdminRow> CustomerById(string id)
    {
        await using var db = await Open();
        return await db.QuerySingleOrDefaultAsync<CustomerAdminRow>("""
            SELECT id,email,display_name,enabled,email_confirmed,created_utc FROM users u WHERE id=@id
              AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role_id='customer')
            """, new { id }) ?? throw new StoreException(404, "Customer not found.");
    }
    public async Task SetCustomerEnabled(string id, bool enabled, string actor)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        var user = await db.QuerySingleOrDefaultAsync<CustomerAdminRow>("SELECT id,email,enabled FROM users WHERE id=@id FOR UPDATE", new { id }, tx)
            ?? throw new StoreException(404, "Customer not found.");
        var roles = (await db.QueryAsync<string>("SELECT role_id FROM user_roles WHERE user_id=@id", new { id }, tx)).ToArray();
        if (!roles.Contains("customer") || roles.Contains("admin") || id == actor)
            throw new StoreException(409, "This action only applies to customer accounts without administrator access.");
        if (user.Enabled != enabled)
        {
            await db.ExecuteAsync("""
                UPDATE users SET enabled=@enabled,security_stamp=@stamp,concurrency_stamp=@stamp,updated_utc=UTC_TIMESTAMP(6)
                WHERE id=@id
                """, new { id, enabled, stamp = Stamp() }, tx);
            await db.ExecuteAsync("UPDATE user_sessions SET revoked_utc=UTC_TIMESTAMP(6) WHERE user_id=@id AND revoked_utc IS NULL", new { id }, tx);
            await Audit(db, tx, actor, enabled ? "customer.enabled" : "customer.disabled", id);
        }
        await tx.CommitAsync();
    }
}
