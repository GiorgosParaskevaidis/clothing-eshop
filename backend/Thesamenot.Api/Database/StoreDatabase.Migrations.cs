using System.Security.Cryptography;
using System.Text;
using Dapper;
using MySqlConnector;

namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    public async Task VerifyRuntimeSchema(string contentRoot)
    {
        await using var db = await Open();
        if (await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='schema_migrations'") != 1)
            throw new InvalidOperationException("Apply migrations with StoreMaintenance before starting this version.");
        foreach (var file in Directory.GetFiles(Path.Combine(contentRoot, "Database", "Migrations"), "*.sql"))
        {
            var version = Path.GetFileName(file);
            var sql = (await File.ReadAllTextAsync(file)).Replace("\r\n", "\n");
            var checksum = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sql)));
            var actual = await db.QuerySingleOrDefaultAsync<MigrationEntry>("SELECT * FROM schema_migrations WHERE version=@version", new { version });
            if (actual is null || actual.State != "applied" || actual.Checksum != checksum)
                throw new InvalidOperationException("Migration " + version + " is missing or changed. Use StoreMaintenance; runtime schema changes are disabled.");
        }
    }
    public async Task VerifyIdentitySchema()
    {
        await using var db = await Open();
        var state = await db.ExecuteScalarAsync<string>("SELECT state FROM schema_migrations WHERE version='002_identity.sql'");
        if (state != "applied") throw new InvalidOperationException("Apply identity migrations with StoreMaintenance before enabling accounts.");
        if (await db.ExecuteScalarAsync<string>("SELECT state FROM schema_migrations WHERE version='003_customer_orders.sql'") != "applied")
            throw new InvalidOperationException("Apply customer/order migrations with StoreMaintenance before starting the application.");
        if (await db.ExecuteScalarAsync<string>("SELECT state FROM schema_migrations WHERE version='004_catalog.sql'") != "applied")
            throw new InvalidOperationException("Apply catalog migrations with StoreMaintenance before starting the application.");
        if (await db.ExecuteScalarAsync<string>("SELECT state FROM schema_migrations WHERE version='006_order_operations.sql'") != "applied")
            throw new InvalidOperationException("Apply commerce operations migrations with StoreMaintenance before starting the application.");
    }
    public async Task<int> Migrate(string contentRoot, CancellationToken cancellationToken = default)
    {
        await using var db = await Open();
        var lockName = "tsn-migrate-" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(db.Database)))[..40];
        if (await db.ExecuteScalarAsync<int>(new CommandDefinition("SELECT GET_LOCK(@lockName,30)", new { lockName }, cancellationToken: cancellationToken)) != 1)
            throw new InvalidOperationException("Another migration is running.");
        try
        {
            await db.ExecuteAsync("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                  version VARCHAR(100) PRIMARY KEY, checksum CHAR(64) NOT NULL,
                  state VARCHAR(12) NOT NULL, applied_utc DATETIME(6) NULL
                ) ENGINE=InnoDB
                """);
            var applied = 0;
            foreach (var file in Directory.GetFiles(Path.Combine(contentRoot, "Database", "Migrations"), "*.sql").Order(StringComparer.Ordinal))
            {
                var version = Path.GetFileName(file);
                var sql = (await File.ReadAllTextAsync(file, cancellationToken)).Replace("\r\n", "\n");
                var checksum = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sql)));
                var existing = await db.QuerySingleOrDefaultAsync<MigrationEntry>("SELECT * FROM schema_migrations WHERE version=@version", new { version });
                if (existing is not null)
                {
                    if (existing.Checksum != checksum || existing.State != "applied")
                        throw new InvalidOperationException("Migration " + version + " requires explicit operator review; checksum changed or previous execution did not finish.");
                    continue;
                }
                if (version == "001_commerce_baseline.sql") await ValidateCommerceBaseline(db);
                if (version == "002_identity.sql" && await db.ExecuteScalarAsync<int>("""
                    SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
                      AND TABLE_NAME IN ('users','roles','user_roles','user_sessions','user_action_tokens',
                        'user_mfa','user_recovery_codes','auth_rate_windows','audit_log')
                    """) != 0)
                    throw new InvalidOperationException("Existing identity tables require explicit operator review before migration adoption.");
                await db.ExecuteAsync("INSERT INTO schema_migrations(version,checksum,state) VALUES(@version,@checksum,'applying')", new { version, checksum });
                try
                {
                    await db.ExecuteAsync(new CommandDefinition(sql, cancellationToken: cancellationToken, commandTimeout: 120));
                    await db.ExecuteAsync("UPDATE schema_migrations SET state='applied',applied_utc=UTC_TIMESTAMP(6) WHERE version=@version", new { version });
                    applied++;
                }
                catch
                {
                    await db.ExecuteAsync("UPDATE schema_migrations SET state='failed' WHERE version=@version", new { version });
                    throw;
                }
            }
            return applied;
        }
        finally { await db.ExecuteAsync("SELECT RELEASE_LOCK(@lockName)", new { lockName }); }
    }

    private static async Task ValidateCommerceBaseline(MySqlConnection db)
    {
        var expected = new Dictionary<string, string[]>
        {
            ["products"] = ["id", "name", "description", "price_cents", "edition", "front_image", "back_image", "active"],
            ["variants"] = ["id", "product_id", "size", "available", "version"],
            ["orders"] = ["id", "public_token", "request_key", "payload_hash", "email", "name", "address", "city", "postal_code", "country", "status", "payment_mode", "stripe_session_id", "checkout_url", "subtotal_cents", "shipping_cents", "total_cents", "created_utc", "expires_utc"],
            ["order_items"] = ["id", "order_id", "variant_id", "product_name", "size", "quantity", "unit_price_cents"],
            ["subscribers"] = ["email", "consent_utc", "consent_version", "unsubscribe_token"],
            ["payment_events"] = ["id", "received_utc"]
        };
        var definitions = new Dictionary<string, string>
        {
            ["products"] = "id=varchar:40:NO;name=varchar:120:NO;description=varchar:1000:NO;price_cents=int::NO;edition=int::NO;front_image=varchar:200:NO;back_image=varchar:200:NO;active=tinyint::NO",
            ["variants"] = "id=varchar:60:NO;product_id=varchar:40:NO;size=varchar:8:NO;available=int::NO;version=int::NO",
            ["orders"] = "id=varchar:32:NO;public_token=varchar:64:NO;request_key=varchar:64:NO;payload_hash=varchar:64:NO;email=varchar:254:NO;name=varchar:120:NO;address=varchar:250:NO;city=varchar:120:NO;postal_code=varchar:24:NO;country=varchar:2:NO;status=varchar:30:NO;payment_mode=varchar:20:NO;stripe_session_id=varchar:200:YES;checkout_url=text:65535:YES;subtotal_cents=int::NO;shipping_cents=int::NO;total_cents=int::NO;created_utc=datetime:6:NO;expires_utc=datetime:6:NO",
            ["order_items"] = "id=bigint::NO;order_id=varchar:32:NO;variant_id=varchar:60:NO;product_name=varchar:120:NO;size=varchar:8:NO;quantity=int::NO;unit_price_cents=int::NO",
            ["subscribers"] = "email=varchar:254:NO;consent_utc=datetime:6:NO;consent_version=varchar:30:NO;unsubscribe_token=varchar:64:NO",
            ["payment_events"] = "id=varchar:200:NO;received_utc=datetime:6:NO"
        };
        var uniqueKeys = new Dictionary<string, string[]>
        {
            ["products"] = ["id"],
            ["variants"] = ["id", "product_id,size"],
            ["orders"] = ["id", "public_token", "request_key", "stripe_session_id"],
            ["order_items"] = ["id"],
            ["subscribers"] = ["email", "unsubscribe_token"],
            ["payment_events"] = ["id"]
        };
        var foreignKeys = new Dictionary<string, string[]>
        {
            ["products"] = [],
            ["variants"] = ["product_id=products.id"],
            ["orders"] = [],
            ["order_items"] = ["order_id=orders.id", "variant_id=variants.id"],
            ["subscribers"] = [],
            ["payment_events"] = []
        };
        foreach (var (table, columns) in expected)
        {
            var actual = (await db.QueryAsync<string>(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@table", new { table })).ToArray();
            if (actual.Length != 0 && !actual.Order().SequenceEqual(columns.Order()))
                throw new InvalidOperationException("Existing commerce table " + table + " does not match the reviewed baseline.");
            if (actual.Length != 0 && await db.ExecuteScalarAsync<string>(
                "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@table", new { table }) != "InnoDB")
                throw new InvalidOperationException("Commerce baseline requires InnoDB.");
            if (actual.Length == 0) continue;
            var actualDefinitions = await db.QueryAsync<string>("""
                SELECT CONCAT(COLUMN_NAME,'=',DATA_TYPE,':',COALESCE(CHARACTER_MAXIMUM_LENGTH,DATETIME_PRECISION,''),':',IS_NULLABLE)
                FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@table
                """, new { table });
            var actualKeys = await db.QueryAsync<string>("""
                SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',')
                FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@table AND NON_UNIQUE=0 GROUP BY INDEX_NAME
                """, new { table });
            var actualForeign = await db.QueryAsync<string>("""
                SELECT CONCAT(COLUMN_NAME,'=',REFERENCED_TABLE_NAME,'.',REFERENCED_COLUMN_NAME)
                FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@table AND REFERENCED_TABLE_NAME IS NOT NULL
                """, new { table });
            var primary = await db.ExecuteScalarAsync<string>("""
                SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',')
                FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@table AND INDEX_NAME='PRIMARY'
                """, new { table });
            if (!actualDefinitions.Order().SequenceEqual(definitions[table].Split(';').Order()) ||
                !actualKeys.Order().SequenceEqual(uniqueKeys[table].Order()) ||
                !actualForeign.Order().SequenceEqual(foreignKeys[table].Order()) || primary != uniqueKeys[table][0])
                throw new InvalidOperationException("Existing commerce schema " + table + " requires operator review before baseline adoption.");
        }
    }
    private sealed class MigrationEntry
    {
        public string Checksum { get; set; } = "";
        public string State { get; set; } = "";
    }
}
