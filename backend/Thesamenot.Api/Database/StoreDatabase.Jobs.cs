using System.Text.Json;
using Dapper;
using MySqlConnector;
using Microsoft.AspNetCore.DataProtection;
namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    private IDataProtector JobProtector => (protection ?? throw new InvalidOperationException("Job protection unavailable.")).CreateProtector("store-jobs-v1");
    internal async Task<string> EnqueueJob(MySqlConnection db, MySqlTransaction tx, string key, string kind, object payload)
    {
        var id = Guid.NewGuid().ToString("N");
        await db.ExecuteAsync("INSERT IGNORE INTO background_jobs(id,dedup_key,kind,protected_payload) VALUES(@id,@key,@kind,@payload)",
            new { id, key, kind, payload = JobProtector.Protect(JsonSerializer.Serialize(payload)) }, tx);
        return await db.QuerySingleAsync<string>("SELECT id FROM background_jobs WHERE dedup_key=@key", new { key }, tx);
    }
    public T JobPayload<T>(StoreJob job) => JsonSerializer.Deserialize<T>(JobProtector.Unprotect(job.ProtectedPayload)) ?? throw new InvalidOperationException("Invalid job payload.");
    public async Task<string?> JobIdByKey(string key)
    {
        await using var db = await Open(); return await db.ExecuteScalarAsync<string>("SELECT id FROM background_jobs WHERE dedup_key=@key", new { key });
    }
    public async Task<string> EnqueueEmail(EmailJob value, string? key = null)
    {
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        var id = await EnqueueJob(db, tx, key ?? Guid.NewGuid().ToString("N"), "email", value); await tx.CommitAsync(); return id;
    }
    public async Task EnqueueProviderEvent(string eventId, string json)
    {
        if (string.IsNullOrWhiteSpace(eventId) || eventId.Length > 200) throw new StoreException(400, "Invalid event id.");
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        await EnqueueJob(db, tx, "stripe:" + eventId, "stripe-event", new ProviderEventJob(json)); await tx.CommitAsync();
    }
    public async Task ScheduleReconciliation()
    {
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        var ids = await db.QueryAsync<string>("""
            SELECT o.id FROM orders o WHERE o.status='pending' AND o.expires_utc<UTC_TIMESTAMP(6)
              AND NOT EXISTS(SELECT 1 FROM background_jobs j WHERE j.dedup_key=CONCAT('reconcile-order:',o.id))
            ORDER BY o.expires_utc,o.id LIMIT 100
            """, transaction: tx);
        foreach (var id in ids) await EnqueueJob(db, tx, "reconcile-order:" + id, "reconcile-order", new ReconcileOrderJob(id));
        await tx.CommitAsync();
    }
    public async Task<StoreJob?> LeaseJob(string? kind = null, string? id = null)
    {
        // Queue consumers must not hold next-key/gap locks across unrelated queues.
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        var job = await db.QueryFirstOrDefaultAsync<StoreJob>("""
            SELECT * FROM background_jobs WHERE (@kind IS NULL OR kind=@kind) AND (@id IS NULL OR id=@id)
              AND ((state='pending' AND next_utc<=UTC_TIMESTAMP(6)) OR (state='processing' AND lease_until_utc<UTC_TIMESTAMP(6)))
            ORDER BY next_utc,id LIMIT 1 FOR UPDATE SKIP LOCKED
            """, new { kind, id }, tx);
        if (job is null) return null;
        job.LeaseId = Guid.NewGuid().ToString("N"); job.Attempts++;
        await db.ExecuteAsync("""
            UPDATE background_jobs SET state='processing',attempts=attempts+1,lease_id=@LeaseId,
              lease_until_utc=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 120 SECOND),updated_utc=UTC_TIMESTAMP(6) WHERE id=@Id
            """, job, tx);
        await tx.CommitAsync(); return job;
    }
    public async Task FinishJob(StoreJob job, string? error = null, bool permanent = false)
    {
        await using var db = await Open();
        var state = error is null ? "completed" : permanent || job.Attempts >= 8 ? "dead" : "pending";
        await db.ExecuteAsync("""
            UPDATE background_jobs SET state=@state,last_code=@error,lease_id=NULL,lease_until_utc=NULL,
              next_utc=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL @delay SECOND),updated_utc=UTC_TIMESTAMP(6)
            WHERE id=@Id AND lease_id=@LeaseId AND state='processing'
            """, new { job.Id, job.LeaseId, state, error, delay = Math.Min(3600, 5 * (1 << Math.Min(job.Attempts, 9))) });
    }
    public async Task<bool> ExtendLease(StoreJob job)
    {
        await using var db = await Open();
        return await db.ExecuteAsync("UPDATE background_jobs SET lease_until_utc=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 120 SECOND) WHERE id=@Id AND lease_id=@LeaseId AND state='processing'", job) == 1;
    }
    public async Task<object> Jobs(int page)
    {
        Validation.AccountValidation.Pagination(page, 24); await using var db = await Open();
        return new
        {
            items = await db.QueryAsync("""
            SELECT id,kind,state,attempts,next_utc nextUtc,lease_until_utc leaseUntilUtc,last_code lastCode,created_utc createdUtc,
              CASE WHEN kind='stripe-event' THEN SUBSTRING(dedup_key,8) ELSE NULL END providerReference
            FROM background_jobs ORDER BY created_utc DESC,id DESC LIMIT 24 OFFSET @offset
            """, new { offset = (page - 1) * 24 }),
            page,
            pageSize = 24,
            total = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM background_jobs"),
            incidents = await db.QueryAsync("SELECT id,order_id orderId,event_id eventId,reason,amount_cents amountCents,currency,created_utc createdUtc FROM payment_incidents WHERE NOT resolved ORDER BY id DESC LIMIT 100")
        };
    }
    public async Task ReplayJob(string id, string actor)
    {
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        if (await db.ExecuteAsync("UPDATE background_jobs SET state='pending',attempts=0,next_utc=UTC_TIMESTAMP(6),last_code=NULL WHERE id=@id AND state='dead'", new { id }, tx) != 1)
            throw new StoreException(409, "Only dead-letter jobs can be replayed.");
        await Audit(db, tx, actor, "job.replayed", id); await tx.CommitAsync();
    }
    private async Task History(MySqlConnection db, MySqlTransaction tx, string orderId, string type, string detail, string actor = "system")
    {
        await db.ExecuteAsync("INSERT INTO order_history(order_id,event_type,detail,actor) VALUES(@orderId,@type,@detail,@actor)", new { orderId, type, detail, actor }, tx);
    }
}
