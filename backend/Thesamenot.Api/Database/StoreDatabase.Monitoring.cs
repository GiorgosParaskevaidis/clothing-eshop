using Dapper;
namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    public async Task<int> IncompletePublishedProducts()
    {
        await using var db = await Open();
        return await db.ExecuteScalarAsync<int>("""
            SELECT COUNT(*) FROM products p WHERE p.status='published' AND (
              TRIM(p.material)='' OR TRIM(p.care)='' OR TRIM(p.size_guide)='' OR p.currency<>'EUR' OR
              NOT EXISTS(SELECT 1 FROM product_images WHERE product_id=p.id) OR
              NOT EXISTS(SELECT 1 FROM variants WHERE product_id=p.id AND active))
            """);
    }
    public async Task<object> OperationalHealth()
    {
        await using var db = await Open();
        return new
        {
            database = "connected",
            incompletePublishedProducts = await IncompletePublishedProducts(),
            jobs = await db.QueryAsync("SELECT kind,state,COUNT(*) count,MIN(created_utc) oldestUtc FROM background_jobs WHERE state<>'completed' GROUP BY kind,state"),
            paymentIncidents = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM payment_incidents WHERE NOT resolved"),
            expiredReservations = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM orders WHERE status='pending' AND reservation_status='active' AND expires_utc<UTC_TIMESTAMP(6)"),
            awaitingDeposits = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM orders WHERE status='awaiting_payment'"),
            awaitingCourierCollections = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM orders WHERE payment_mode='CashOnDelivery' AND payment_status='pending' AND status IN ('confirmed','fulfilled')"),
            openReturns = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM return_requests WHERE state NOT IN ('closed','rejected')")
        };
    }
}
