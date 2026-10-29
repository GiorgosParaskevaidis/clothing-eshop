using System.Security.Cryptography;
using Dapper;
namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    public async Task RequestNewsletter(NewsletterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (!await TakeAuthTargetLimit("newsletter:" + email.ToUpperInvariant())) throw new StoreException(429, "Too many requests. Please retry later.");
        await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        await db.ExecuteAsync("INSERT IGNORE INTO subscribers(email,consent_utc,consent_version,unsubscribe_token_hash,status) VALUES(@email,UTC_TIMESTAMP(6),'newsletter-v2',@hash,'pending')", new { email, hash = SecretHash(Convert.ToHexString(RandomNumberGenerator.GetBytes(32))) }, tx);
        var status = await db.QuerySingleAsync<string>("SELECT status FROM subscribers WHERE email=@email FOR UPDATE", new { email }, tx);
        if (status == "confirmed") { await tx.CommitAsync(); return; }
        await db.ExecuteAsync("UPDATE subscribers SET status='pending',consent_utc=UTC_TIMESTAMP(6),consent_version='newsletter-v2' WHERE email=@email", new { email }, tx);
        await db.ExecuteAsync("UPDATE newsletter_tokens SET used_utc=UTC_TIMESTAMP(6) WHERE email=@email AND purpose='confirm' AND used_utc IS NULL", new { email }, tx);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        await db.ExecuteAsync("INSERT INTO newsletter_tokens(id,email,purpose,token_hash,expires_utc) VALUES(@id,@email,'confirm',@hash,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 24 HOUR))", new { id = Guid.NewGuid().ToString("N"), email, hash = SecretHash(token) }, tx);
        await EnqueueJob(db, tx, "newsletter:confirm:" + SecretHash(token), "email", new EmailJob(email, "newsletter-confirm", token));
        await tx.CommitAsync();
    }
    public async Task ConfirmNewsletter(string token)
    {
        var hash = SecretHash(Validation.AuthValidation.Token(token));
        await using var db = await Open();
        var email = await db.ExecuteScalarAsync<string>("SELECT email FROM newsletter_tokens WHERE token_hash=@hash AND purpose='confirm'", new { hash });
        if (email is null) throw new StoreException(400, "Invalid or expired newsletter link.");
        await using var tx = await db.BeginTransactionAsync();
        await db.QuerySingleAsync<string>("SELECT email FROM subscribers WHERE email=@email FOR UPDATE", new { email }, tx);
        if (await db.ExecuteAsync("UPDATE newsletter_tokens SET used_utc=UTC_TIMESTAMP(6) WHERE token_hash=@hash AND purpose='confirm' AND used_utc IS NULL AND expires_utc>UTC_TIMESTAMP(6)", new { hash }, tx) != 1)
            throw new StoreException(400, "Invalid or expired newsletter link.");
        var unsubscribe = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        await db.ExecuteAsync("UPDATE subscribers SET status='confirmed',confirmed_utc=UTC_TIMESTAMP(6),unsubscribed_utc=NULL,unsubscribe_token_hash=@unsubscribe WHERE email=@email", new { email, unsubscribe = SecretHash(unsubscribe) }, tx);
        await EnqueueJob(db, tx, "newsletter:welcome:" + hash, "email", new EmailJob(email, "newsletter-unsubscribe", unsubscribe, Text: "Your thesamenot newsletter subscription is confirmed.\n\nUnsubscribe at:\n" + configuration["Store:PublicUrl"]!.TrimEnd('/') + "/unsubscribe#token=" + Uri.EscapeDataString(unsubscribe)));
        await tx.CommitAsync();
    }
    public async Task LeaveNewsletter(string token)
    {
        var hash = SecretHash(Validation.AuthValidation.Token(token)); await using var db = await Open(); await using var tx = await db.BeginTransactionAsync();
        var email = await db.ExecuteScalarAsync<string>("SELECT email FROM subscribers WHERE unsubscribe_token_hash=@hash FOR UPDATE", new { hash }, tx);
        if (email is not null)
        {
            await db.ExecuteAsync("UPDATE subscribers SET status='unsubscribed',unsubscribed_utc=UTC_TIMESTAMP(6),unsubscribe_token_hash=@newHash WHERE email=@email", new { email, newHash = SecretHash(Convert.ToHexString(RandomNumberGenerator.GetBytes(32))) }, tx);
            await db.ExecuteAsync("UPDATE newsletter_tokens SET used_utc=UTC_TIMESTAMP(6) WHERE email=@email AND used_utc IS NULL", new { email }, tx);
        }
        await tx.CommitAsync();
    }
}
