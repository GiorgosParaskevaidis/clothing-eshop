using System.Security.Cryptography;
using System.Text;
using Dapper;
using Microsoft.AspNetCore.Identity;
using MySqlConnector;
using Thesamenot.Api.Security.Identity;

namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    public static string SecretHash(string secret) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret)));
    private static string Stamp() => Guid.NewGuid().ToString("N");

    public async Task<StoreUser?> IdentityUserBy(string column, string value, CancellationToken ct = default)
    {
        if (column is not ("id" or "normalized_email" or "normalized_user_name")) throw new ArgumentException("Invalid lookup.");
        await using var db = await Open();
        return await db.QuerySingleOrDefaultAsync<StoreUser>(new CommandDefinition(
            "SELECT * FROM users WHERE " + column + "=@value", new { value }, cancellationToken: ct));
    }

    public async Task<IdentityResult> CreateIdentityUser(StoreUser user, bool bootstrapAdmin = false, CancellationToken ct = default)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync(ct);
        if (bootstrapAdmin)
        {
            // Lock the role row so two maintenance processes cannot both bootstrap the first admin.
            await db.QuerySingleAsync<string>("SELECT id FROM roles WHERE id='admin' FOR UPDATE", transaction: tx);
            if (await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM user_roles WHERE role_id='admin'", transaction: tx) > 0)
                return IdentityResult.Failed(new IdentityError { Code = "AdminExists", Description = "An administrator already exists." });
        }
        try
        {
            await db.ExecuteAsync(new CommandDefinition("""
                INSERT INTO users(id,user_name,normalized_user_name,email,normalized_email,email_confirmed,email_confirmed_at,
                  password_hash,display_name,enabled,security_stamp,concurrency_stamp,lockout_enabled,access_failed_count,
                  lockout_end_utc,two_factor_enabled,created_utc,updated_utc)
                VALUES(@Id,@UserName,@NormalizedUserName,@Email,@NormalizedEmail,@EmailConfirmed,
                  IF(@EmailConfirmed,UTC_TIMESTAMP(6),NULL),@PasswordHash,@DisplayName,@Enabled,@SecurityStamp,
                  @ConcurrencyStamp,@LockoutEnabled,@AccessFailedCount,@LockoutEndUtc,@TwoFactorEnabled,@CreatedUtc,@UpdatedUtc)
                """, user, tx, cancellationToken: ct));
            await db.ExecuteAsync("INSERT INTO user_roles(user_id,role_id) VALUES(@Id,@role)", new { user.Id, role = bootstrapAdmin ? "admin" : "customer" }, tx);
            await Audit(db, tx, user.Id, bootstrapAdmin ? "admin.bootstrap" : "user.register", user.Id);
            if (!bootstrapAdmin && !user.EmailConfirmed)
            {
                var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
                await InsertActionToken(db, tx, user, "verify-email", TimeSpan.FromHours(24), null, token);
                await EnqueueJob(db, tx, "email:registration:" + user.Id, "email", new EmailJob(user.Email!, "verify-email", token));
            }
            await tx.CommitAsync(ct);
            return IdentityResult.Success;
        }
        catch (MySqlException ex) when (ex.Number == 1062)
        {
            return IdentityResult.Failed(new IdentityError { Code = "DuplicateEmail", Description = "Unable to create this account." });
        }
    }

    public async Task<IdentityResult> UpdateIdentityUser(StoreUser user, CancellationToken ct = default)
    {
        await using var db = await Open();
        var oldStamp = user.ConcurrencyStamp;
        var newStamp = Stamp();
        var changed = await db.ExecuteAsync(new CommandDefinition("""
            UPDATE users SET user_name=@UserName,normalized_user_name=@NormalizedUserName,email=@Email,
              normalized_email=@NormalizedEmail,email_confirmed=@EmailConfirmed,
              email_confirmed_at=IF(@EmailConfirmed,COALESCE(email_confirmed_at,UTC_TIMESTAMP(6)),NULL),
              password_hash=@PasswordHash,display_name=@DisplayName,enabled=@Enabled,security_stamp=@SecurityStamp,
              concurrency_stamp=@newStamp,lockout_enabled=@LockoutEnabled,access_failed_count=@AccessFailedCount,
              lockout_end_utc=@LockoutEndUtc,two_factor_enabled=@TwoFactorEnabled,updated_utc=UTC_TIMESTAMP(6)
            WHERE id=@Id AND concurrency_stamp=@oldStamp
            """, new
        {
            user.Id,
            user.UserName,
            user.NormalizedUserName,
            user.Email,
            user.NormalizedEmail,
            user.EmailConfirmed,
            user.PasswordHash,
            user.DisplayName,
            user.Enabled,
            user.SecurityStamp,
            user.LockoutEnabled,
            user.AccessFailedCount,
            user.LockoutEndUtc,
            user.TwoFactorEnabled,
            newStamp,
            oldStamp
        }, cancellationToken: ct));
        if (changed == 1) { user.ConcurrencyStamp = newStamp; return IdentityResult.Success; }
        return IdentityResult.Failed(new IdentityError { Code = "ConcurrencyFailure", Description = "Account changed. Please retry." });
    }

    public async Task<IList<string>> IdentityRoles(string userId)
    {
        await using var db = await Open();
        return (await db.QueryAsync<string>("SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=@userId ORDER BY r.name", new { userId })).ToList();
    }
    public async Task ChangeIdentityRole(string userId, string normalizedRole, bool add)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        if (add) await db.ExecuteAsync("""
            INSERT IGNORE INTO user_roles(user_id,role_id) SELECT @userId,id FROM roles WHERE normalized_name=@normalizedRole
            """, new { userId, normalizedRole }, tx);
        else await db.ExecuteAsync("""
            DELETE ur FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=@userId AND r.normalized_name=@normalizedRole
            """, new { userId, normalizedRole }, tx);
        await db.ExecuteAsync("UPDATE users SET security_stamp=@stamp,concurrency_stamp=@stamp WHERE id=@userId", new { userId, stamp = Stamp() }, tx);
        await db.ExecuteAsync("UPDATE user_sessions SET revoked_utc=UTC_TIMESTAMP(6) WHERE user_id=@userId AND revoked_utc IS NULL", new { userId }, tx);
        await Audit(db, tx, null, "role.change", userId);
        await tx.CommitAsync();
    }
    public async Task<IList<StoreUser>> UsersInIdentityRole(string normalizedRole)
    {
        await using var db = await Open();
        return (await db.QueryAsync<StoreUser>("SELECT u.* FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.normalized_name=@normalizedRole", new { normalizedRole })).ToList();
    }
    public async Task<StoreRole?> IdentityRoleBy(string column, string value)
    {
        if (column is not ("id" or "normalized_name")) throw new ArgumentException("Invalid lookup.");
        await using var db = await Open();
        return await db.QuerySingleOrDefaultAsync<StoreRole>("SELECT * FROM roles WHERE " + column + "=@value", new { value });
    }
    public async Task<IdentityResult> SaveIdentityRole(StoreRole role, bool create)
    {
        await using var db = await Open();
        try
        {
            var next = Stamp();
            var count = create
                ? await db.ExecuteAsync("INSERT INTO roles(id,name,normalized_name,concurrency_stamp) VALUES(@Id,@Name,@NormalizedName,@next)", new { role.Id, role.Name, role.NormalizedName, next })
                : await db.ExecuteAsync("UPDATE roles SET name=@Name,normalized_name=@NormalizedName,concurrency_stamp=@next WHERE id=@Id AND concurrency_stamp=@ConcurrencyStamp",
                    new { role.Id, role.Name, role.NormalizedName, role.ConcurrencyStamp, next });
            if (count == 1) { role.ConcurrencyStamp = next; return IdentityResult.Success; }
        }
        catch (MySqlException ex) when (ex.Number == 1062) { }
        return IdentityResult.Failed(new IdentityError { Code = "RoleConflict", Description = "Role changed or already exists." });
    }
    public async Task<IdentityResult> DeleteIdentityRole(StoreRole role)
    {
        if (role.Id is "admin" or "customer") return IdentityResult.Failed(new IdentityError { Description = "Built-in roles cannot be removed." });
        await using var db = await Open();
        if (await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM user_roles WHERE role_id=@Id", role) != 0)
            return IdentityResult.Failed(new IdentityError { Description = "Role is in use." });
        return await db.ExecuteAsync("DELETE FROM roles WHERE id=@Id AND concurrency_stamp=@ConcurrencyStamp", role) == 1
            ? IdentityResult.Success : IdentityResult.Failed(new IdentityError { Code = "ConcurrencyFailure" });
    }

    public async Task RecordLoginFailure(string userId)
    {
        await using var db = await Open();
        // Atomic counters also cover concurrent attempts from multiple IP addresses/instances.
        await db.ExecuteAsync("""
            UPDATE users SET access_failed_count=IF(lockout_end_utc IS NOT NULL,1,access_failed_count+1),
              lockout_end_utc=IF(access_failed_count>=5,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE),NULL),
              concurrency_stamp=@stamp,updated_utc=UTC_TIMESTAMP(6)
              WHERE id=@userId AND (lockout_end_utc IS NULL OR lockout_end_utc<=UTC_TIMESTAMP(6))
            """, new { userId, stamp = Stamp() });
    }
    public async Task ResetLoginFailures(string userId)
    {
        await using var db = await Open();
        await db.ExecuteAsync("UPDATE users SET access_failed_count=0,lockout_end_utc=NULL,concurrency_stamp=@stamp WHERE id=@userId", new { userId, stamp = Stamp() });
    }
    public async Task<bool> TakeAuthTargetLimit(string key, int limit = 5)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        var hash = SecretHash(key);
        await db.ExecuteAsync("""
            INSERT INTO auth_rate_windows(key_hash,window_utc,count) VALUES(@hash,UTC_TIMESTAMP(6),1)
            ON DUPLICATE KEY UPDATE count=IF(window_utc<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 HOUR),1,count+1),
              window_utc=IF(window_utc<DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 HOUR),UTC_TIMESTAMP(6),window_utc)
            """, new { hash }, tx);
        var count = await db.ExecuteScalarAsync<int>("SELECT count FROM auth_rate_windows WHERE key_hash=@hash", new { hash }, tx);
        await tx.CommitAsync();
        return count <= limit;
    }

    private static Task<int> InsertActionToken(MySqlConnection db, MySqlTransaction tx, StoreUser user, string purpose, TimeSpan lifetime, string? targetEmail, string token) =>
        db.ExecuteAsync("""
            INSERT INTO user_action_tokens(id,user_id,purpose,token_hash,security_stamp,target_email,created_utc,expires_utc)
            VALUES(@tokenId,@Id,@purpose,@hash,@SecurityStamp,@targetEmail,UTC_TIMESTAMP(6),@expires)
            """, new { tokenId = Stamp(), user.Id, purpose, hash = SecretHash(token), user.SecurityStamp, targetEmail, expires = DateTime.UtcNow.Add(lifetime) }, tx);
    public async Task<string> IssueActionToken(StoreUser user, string purpose, TimeSpan lifetime, string? targetEmail = null, bool queueMail = false)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        await InsertActionToken(db, tx, user, purpose, lifetime, targetEmail, token);
        if (queueMail) await EnqueueJob(db, tx, "email:action:" + SecretHash(token), "email", new EmailJob(targetEmail ?? user.Email!, purpose, token));
        if (queueMail && purpose == "change-email") await EnqueueJob(db, tx, "email:change-notice:" + SecretHash(token), "email", new EmailJob(user.Email!, "email-change-requested"));
        await tx.CommitAsync();
        return token;
    }
    public async Task<ActionToken?> GetActionToken(string token, string purpose)
    {
        await using var db = await Open();
        return await db.QuerySingleOrDefaultAsync<ActionToken>("SELECT * FROM user_action_tokens WHERE token_hash=@hash AND purpose=@purpose AND used_utc IS NULL AND expires_utc>UTC_TIMESTAMP(6) AND attempts<5", new { hash = SecretHash(token), purpose });
    }
    public async Task<bool> CompleteAccountAction(string token, string purpose, string? passwordHash = null)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        var hash = SecretHash(token);
        var action = await db.QuerySingleOrDefaultAsync<ActionToken>("SELECT * FROM user_action_tokens WHERE token_hash=@hash AND purpose=@purpose AND used_utc IS NULL AND expires_utc>UTC_TIMESTAMP(6) FOR UPDATE", new { hash, purpose }, tx);
        if (action is null) return false;
        var user = await db.QuerySingleOrDefaultAsync<StoreUser>("SELECT * FROM users WHERE id=@UserId FOR UPDATE", action, tx);
        if (user is null || !user.Enabled || user.SecurityStamp != action.SecurityStamp) return false;
        var stamp = Stamp();
        try
        {
            if (purpose == "verify-email")
                await db.ExecuteAsync("UPDATE users SET email_confirmed=TRUE,email_confirmed_at=UTC_TIMESTAMP(6),concurrency_stamp=@stamp WHERE id=@Id", new { user.Id, stamp }, tx);
            else if (purpose == "reset-password" && passwordHash is not null)
                await db.ExecuteAsync("UPDATE users SET password_hash=@passwordHash,security_stamp=@stamp,concurrency_stamp=@stamp,access_failed_count=0,lockout_end_utc=NULL WHERE id=@Id", new { user.Id, passwordHash, stamp }, tx);
            else if (purpose == "change-email" && action.TargetEmail is not null)
                await db.ExecuteAsync("""
                    UPDATE users SET email=@email,user_name=@email,normalized_email=@normalized,normalized_user_name=@normalized,
                      email_confirmed=TRUE,email_confirmed_at=UTC_TIMESTAMP(6),security_stamp=@stamp,concurrency_stamp=@stamp
                    WHERE id=@Id
                    """, new { user.Id, email = action.TargetEmail, normalized = action.TargetEmail.ToUpperInvariant(), stamp }, tx);
            else return false;
            await db.ExecuteAsync("UPDATE user_action_tokens SET used_utc=UTC_TIMESTAMP(6) WHERE token_hash=@hash", new { hash }, tx);
            if (purpose != "verify-email")
                await db.ExecuteAsync("UPDATE user_sessions SET revoked_utc=UTC_TIMESTAMP(6) WHERE user_id=@Id AND revoked_utc IS NULL", user, tx);
            await Audit(db, tx, user.Id, "auth." + purpose, user.Id);
            if (purpose == "reset-password") await EnqueueJob(db, tx, "email:security:" + hash, "email", new EmailJob(user.Email!, "password-changed"));
            await tx.CommitAsync();
            return true;
        }
        catch (MySqlException ex) when (ex.Number == 1062) { return false; }
    }

    public async Task<string?> ProtectedMfaKey(string userId)
    {
        await using var db = await Open();
        return await db.QuerySingleOrDefaultAsync<string>("SELECT protected_key FROM user_mfa WHERE user_id=@userId", new { userId });
    }
    public async Task SetProtectedMfaKey(string userId, string protectedKey)
    {
        await using var db = await Open();
        await db.ExecuteAsync("INSERT INTO user_mfa(user_id,protected_key,last_step) VALUES(@userId,@protectedKey,-1) ON DUPLICATE KEY UPDATE protected_key=@protectedKey,last_step=-1", new { userId, protectedKey });
    }
    public async Task ReplaceRecoveryCodes(string userId, IEnumerable<string> codes)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        await WriteRecoveryCodes(db, tx, userId, codes.Select(SecretHash));
        await tx.CommitAsync();
    }
    private static async Task WriteRecoveryCodes(MySqlConnection db, MySqlTransaction tx, string userId, IEnumerable<string> hashes)
    {
        await db.ExecuteAsync("DELETE FROM user_recovery_codes WHERE user_id=@userId", new { userId }, tx);
        foreach (var hash in hashes) await db.ExecuteAsync("INSERT INTO user_recovery_codes(user_id,code_hash) VALUES(@userId,@hash)", new { userId, hash }, tx);
    }
    public async Task<int> CountRecoveryCodes(string userId)
    {
        await using var db = await Open();
        return await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM user_recovery_codes WHERE user_id=@userId AND used_utc IS NULL", new { userId });
    }
    public async Task<bool> RedeemRecoveryCode(string userId, string code)
    {
        await using var db = await Open();
        return await db.ExecuteAsync("UPDATE user_recovery_codes SET used_utc=UTC_TIMESTAMP(6) WHERE user_id=@userId AND code_hash=@hash AND used_utc IS NULL", new { userId, hash = SecretHash(code) }) == 1;
    }

    public async Task<bool> CompleteMfaChallenge(string token, string purpose, StoreUser user, long? step, string? recoveryCode, string[]? newCodes = null)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        var hash = SecretHash(token);
        var action = await db.QuerySingleOrDefaultAsync<ActionToken>("SELECT * FROM user_action_tokens WHERE token_hash=@hash AND purpose=@purpose AND used_utc IS NULL AND expires_utc>UTC_TIMESTAMP(6) AND attempts<5 FOR UPDATE", new { hash, purpose }, tx);
        if (action is null || action.UserId != user.Id) return false;
        var current = await db.QuerySingleAsync<StoreUser>("SELECT * FROM users WHERE id=@Id FOR UPDATE", user, tx);
        if (!current.Enabled || current.SecurityStamp != action.SecurityStamp) return false;
        if (step.HasValue)
        {
            var last = await db.QuerySingleAsync<long>("SELECT last_step FROM user_mfa WHERE user_id=@Id FOR UPDATE", user, tx);
            if (step <= last) return false;
            await db.ExecuteAsync("UPDATE user_mfa SET last_step=@step WHERE user_id=@Id", new { user.Id, step }, tx);
        }
        else if (recoveryCode is null || await db.ExecuteAsync("""
            UPDATE user_recovery_codes SET used_utc=UTC_TIMESTAMP(6)
            WHERE user_id=@Id AND code_hash=@codeHash AND used_utc IS NULL
            """, new { user.Id, codeHash = SecretHash(recoveryCode) }, tx) != 1) return false;
        if (newCodes is not null)
        {
            if (purpose == "admin-mfa-setup")
            {
                user.SecurityStamp = Stamp(); user.TwoFactorEnabled = true;
                await db.ExecuteAsync("UPDATE users SET two_factor_enabled=TRUE,security_stamp=@SecurityStamp,concurrency_stamp=@stamp WHERE id=@Id", new { user.Id, user.SecurityStamp, stamp = Stamp() }, tx);
            }
            await WriteRecoveryCodes(db, tx, user.Id, newCodes.Select(SecretHash));
        }
        await db.ExecuteAsync("UPDATE user_action_tokens SET used_utc=UTC_TIMESTAMP(6) WHERE token_hash=@hash", new { hash }, tx);
        await Audit(db, tx, user.Id, "auth." + purpose, user.Id);
        await tx.CommitAsync();
        return true;
    }
    public async Task FailChallenge(string token)
    {
        await using var db = await Open();
        await db.ExecuteAsync("UPDATE user_action_tokens SET attempts=attempts+1 WHERE token_hash=@hash AND used_utc IS NULL", new { hash = SecretHash(token) });
    }
    public async Task CreateSession(string rawId, StoreUser user, string scheme, string amr, DateTime expires)
    {
        await using var db = await Open();
        await using var tx = await db.BeginTransactionAsync();
        await db.ExecuteAsync("""
            INSERT INTO user_sessions(id_hash,user_id,scheme,security_stamp,amr,created_utc,expires_utc)
            VALUES(@hash,@Id,@scheme,@SecurityStamp,@amr,UTC_TIMESTAMP(6),@expires)
            """, new { hash = SecretHash(rawId), user.Id, scheme, user.SecurityStamp, amr, expires }, tx);
        await Audit(db, tx, user.Id, "session.login", user.Id);
        await tx.CommitAsync();
    }
    public async Task<bool> IsSessionValid(string rawId, string userId, string scheme, string stamp, string amr)
    {
        await using var db = await Open();
        return await db.ExecuteScalarAsync<int>("""
            SELECT COUNT(*) FROM user_sessions s JOIN users u ON u.id=s.user_id
            WHERE s.id_hash=@hash AND s.user_id=@userId AND s.scheme=@scheme AND s.security_stamp=@stamp
              AND u.security_stamp=@stamp AND u.enabled=TRUE AND u.email_confirmed=TRUE AND s.amr=@amr
              AND s.revoked_utc IS NULL AND s.expires_utc>UTC_TIMESTAMP(6)
              AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name=@scheme)
              AND (@scheme<>'Admin' OR (u.two_factor_enabled=TRUE AND @amr='mfa'))
            """, new { hash = SecretHash(rawId), userId, scheme, stamp, amr }) == 1;
    }
    public async Task RevokeSessions(string userId, string? rawSession = null)
    {
        await using var db = await Open();
        await db.ExecuteAsync("UPDATE user_sessions SET revoked_utc=UTC_TIMESTAMP(6) WHERE user_id=@userId AND revoked_utc IS NULL AND (@hash IS NULL OR id_hash=@hash)",
            new { userId, hash = rawSession is null ? null : SecretHash(rawSession) });
    }
    private static Task<int> Audit(MySqlConnection db, MySqlTransaction tx, string? actor, string action, string entity) =>
        db.ExecuteAsync("INSERT INTO audit_log(actor_id,action,entity_id,created_utc) VALUES(@actor,@action,@entity,UTC_TIMESTAMP(6))", new { actor, action, entity }, tx);
}
