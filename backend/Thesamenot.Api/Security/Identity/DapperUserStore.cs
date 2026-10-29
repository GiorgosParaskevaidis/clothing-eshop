using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using MySqlConnector;

namespace Thesamenot.Api.Security.Identity;

public sealed class DapperUserStore(StoreDatabase database, IDataProtectionProvider protection) :
    IUserPasswordStore<StoreUser>, IUserEmailStore<StoreUser>, IUserSecurityStampStore<StoreUser>,
    IUserRoleStore<StoreUser>, IUserLockoutStore<StoreUser>, IUserTwoFactorStore<StoreUser>,
    IUserAuthenticatorKeyStore<StoreUser>, IUserTwoFactorRecoveryCodeStore<StoreUser>
{
    private readonly IDataProtector protector = protection.CreateProtector("thesamenot.mfa.v1");
    public void Dispose() { }
    public Task<string> GetUserIdAsync(StoreUser u, CancellationToken ct) => Task.FromResult(u.Id);
    public Task<string?> GetUserNameAsync(StoreUser u, CancellationToken ct) => Task.FromResult(u.UserName);
    public Task SetUserNameAsync(StoreUser u, string? v, CancellationToken ct) { u.UserName = v; return Task.CompletedTask; }
    public Task<string?> GetNormalizedUserNameAsync(StoreUser u, CancellationToken ct) => Task.FromResult(u.NormalizedUserName);
    public Task SetNormalizedUserNameAsync(StoreUser u, string? v, CancellationToken ct) { u.NormalizedUserName = v; return Task.CompletedTask; }
    public Task<IdentityResult> CreateAsync(StoreUser u, CancellationToken ct) => database.CreateIdentityUser(u, ct: ct);
    public async Task<IdentityResult> UpdateAsync(StoreUser u, CancellationToken ct)
    {
        try { return await database.UpdateIdentityUser(u, ct); }
        catch (MySqlException ex) when (ex.Number == 1062) { return IdentityResult.Failed(new IdentityError { Code = "DuplicateEmail", Description = "Unable to update account." }); }
    }
    public Task<IdentityResult> DeleteAsync(StoreUser u, CancellationToken ct)
    {
        u.Enabled = false; u.SecurityStamp = Guid.NewGuid().ToString("N");
        return UpdateAsync(u, ct);
    }
    public Task<StoreUser?> FindByIdAsync(string id, CancellationToken ct) => database.IdentityUserBy("id", id, ct);
    public Task<StoreUser?> FindByNameAsync(string name, CancellationToken ct) => database.IdentityUserBy("normalized_user_name", name, ct);
    public Task SetPasswordHashAsync(StoreUser u, string? v, CancellationToken ct) { u.PasswordHash = v; return Task.CompletedTask; }
    public Task<string?> GetPasswordHashAsync(StoreUser u, CancellationToken ct) => Task.FromResult(u.PasswordHash);
    public Task<bool> HasPasswordAsync(StoreUser u, CancellationToken ct) => Task.FromResult(u.PasswordHash is not null);
    public Task SetEmailAsync(StoreUser u, string? v, CancellationToken ct) { u.Email = v; return Task.CompletedTask; }
    public Task<string?> GetEmailAsync(StoreUser u, CancellationToken ct) => Task.FromResult(u.Email);
    public Task<bool> GetEmailConfirmedAsync(StoreUser u, CancellationToken ct) => Task.FromResult(u.EmailConfirmed);
    public Task SetEmailConfirmedAsync(StoreUser u, bool v, CancellationToken ct) { u.EmailConfirmed = v; return Task.CompletedTask; }
    public Task<StoreUser?> FindByEmailAsync(string email, CancellationToken ct) => database.IdentityUserBy("normalized_email", email, ct);
    public Task<string?> GetNormalizedEmailAsync(StoreUser u, CancellationToken ct) => Task.FromResult(u.NormalizedEmail);
    public Task SetNormalizedEmailAsync(StoreUser u, string? v, CancellationToken ct) { u.NormalizedEmail = v; return Task.CompletedTask; }
    public Task SetSecurityStampAsync(StoreUser u, string v, CancellationToken ct) { u.SecurityStamp = v; return Task.CompletedTask; }
    public Task<string?> GetSecurityStampAsync(StoreUser u, CancellationToken ct) => Task.FromResult(u.SecurityStamp);
    public async Task AddToRoleAsync(StoreUser u, string role, CancellationToken ct) => await RoleChange(u, role, true, ct);
    public async Task RemoveFromRoleAsync(StoreUser u, string role, CancellationToken ct) => await RoleChange(u, role, false, ct);
    private async Task RoleChange(StoreUser u, string role, bool add, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        await database.ChangeIdentityRole(u.Id, role, add);
        var refreshed = (await database.IdentityUserBy("id", u.Id, ct))!;
        u.SecurityStamp = refreshed.SecurityStamp; u.ConcurrencyStamp = refreshed.ConcurrencyStamp;
    }
    public Task<IList<string>> GetRolesAsync(StoreUser u, CancellationToken ct) => database.IdentityRoles(u.Id);
    public async Task<bool> IsInRoleAsync(StoreUser u, string role, CancellationToken ct) =>
        (await database.IdentityRoles(u.Id)).Any(r => r.ToUpperInvariant() == role);
    public Task<IList<StoreUser>> GetUsersInRoleAsync(string role, CancellationToken ct) => database.UsersInIdentityRole(role);
    public Task<DateTimeOffset?> GetLockoutEndDateAsync(StoreUser u, CancellationToken ct) =>
        Task.FromResult(u.LockoutEndUtc.HasValue ? (DateTimeOffset?)new DateTimeOffset(DateTime.SpecifyKind(u.LockoutEndUtc.Value, DateTimeKind.Utc)) : null);
    public Task SetLockoutEndDateAsync(StoreUser u, DateTimeOffset? v, CancellationToken ct) { u.LockoutEndUtc = v?.UtcDateTime; return Task.CompletedTask; }
    public Task<int> IncrementAccessFailedCountAsync(StoreUser u, CancellationToken ct) => Task.FromResult(++u.AccessFailedCount);
    public Task ResetAccessFailedCountAsync(StoreUser u, CancellationToken ct) { u.AccessFailedCount = 0; return Task.CompletedTask; }
    public Task<int> GetAccessFailedCountAsync(StoreUser u, CancellationToken ct) => Task.FromResult(u.AccessFailedCount);
    public Task<bool> GetLockoutEnabledAsync(StoreUser u, CancellationToken ct) => Task.FromResult(u.LockoutEnabled);
    public Task SetLockoutEnabledAsync(StoreUser u, bool v, CancellationToken ct) { u.LockoutEnabled = v; return Task.CompletedTask; }
    public Task SetTwoFactorEnabledAsync(StoreUser u, bool v, CancellationToken ct) { u.TwoFactorEnabled = v; return Task.CompletedTask; }
    public Task<bool> GetTwoFactorEnabledAsync(StoreUser u, CancellationToken ct) => Task.FromResult(u.TwoFactorEnabled);
    public Task SetAuthenticatorKeyAsync(StoreUser u, string key, CancellationToken ct) => database.SetProtectedMfaKey(u.Id, protector.Protect(key));
    public async Task<string?> GetAuthenticatorKeyAsync(StoreUser u, CancellationToken ct)
    {
        var value = await database.ProtectedMfaKey(u.Id);
        return value is null ? null : protector.Unprotect(value);
    }
    public Task ReplaceCodesAsync(StoreUser u, IEnumerable<string> codes, CancellationToken ct) => database.ReplaceRecoveryCodes(u.Id, codes);
    public Task<bool> RedeemCodeAsync(StoreUser u, string code, CancellationToken ct) => database.RedeemRecoveryCode(u.Id, code);
    public Task<int> CountCodesAsync(StoreUser u, CancellationToken ct) => database.CountRecoveryCodes(u.Id);
}
