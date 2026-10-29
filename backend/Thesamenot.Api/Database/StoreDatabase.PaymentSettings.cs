using Dapper;
using MySqlConnector;

namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    public async Task<PaymentSettings> PaymentSettings()
    {
        await using var db = await Open();
        return await ReadPaymentSettings(db);
    }

    private static Task<PaymentSettings> ReadPaymentSettings(MySqlConnection db, MySqlTransaction? tx = null) =>
        db.QuerySingleAsync<PaymentSettings>(
            "SELECT bank_transfer_enabled,account_holder,iban,bic,version FROM payment_settings WHERE id=1" +
            (tx is null ? "" : " LOCK IN SHARE MODE"), transaction: tx);

    public async Task<PaymentSettings> SavePaymentSettings(PaymentSettings value, string actor)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        if (await db.ExecuteAsync("""
            UPDATE payment_settings SET bank_transfer_enabled=@BankTransferEnabled,account_holder=@AccountHolder,
              iban=@Iban,bic=@Bic,version=version+1,updated_utc=UTC_TIMESTAMP(6) WHERE id=1 AND version=@Version
            """, value, tx) != 1)
            throw new StoreException(409, "Payment settings changed. Reload the saved settings and try again.");
        await Audit(db, tx, actor, "payment_settings.updated", "1");
        await tx.CommitAsync();
        value.Version++;
        return value;
    }
}
