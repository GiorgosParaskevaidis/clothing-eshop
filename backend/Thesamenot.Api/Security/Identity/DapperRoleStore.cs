using Microsoft.AspNetCore.Identity;

namespace Thesamenot.Api.Security.Identity;

public sealed class DapperRoleStore(StoreDatabase database) : IRoleStore<StoreRole>
{
    public void Dispose() { }
    public Task<IdentityResult> CreateAsync(StoreRole role, CancellationToken ct) => database.SaveIdentityRole(role, true);
    public Task<IdentityResult> UpdateAsync(StoreRole role, CancellationToken ct) => database.SaveIdentityRole(role, false);
    public Task<IdentityResult> DeleteAsync(StoreRole role, CancellationToken ct) => database.DeleteIdentityRole(role);
    public Task<string> GetRoleIdAsync(StoreRole role, CancellationToken ct) => Task.FromResult(role.Id);
    public Task<string?> GetRoleNameAsync(StoreRole role, CancellationToken ct) => Task.FromResult(role.Name);
    public Task SetRoleNameAsync(StoreRole role, string? value, CancellationToken ct) { role.Name = value; return Task.CompletedTask; }
    public Task<string?> GetNormalizedRoleNameAsync(StoreRole role, CancellationToken ct) => Task.FromResult(role.NormalizedName);
    public Task SetNormalizedRoleNameAsync(StoreRole role, string? value, CancellationToken ct) { role.NormalizedName = value; return Task.CompletedTask; }
    public Task<StoreRole?> FindByIdAsync(string id, CancellationToken ct) => database.IdentityRoleBy("id", id);
    public Task<StoreRole?> FindByNameAsync(string name, CancellationToken ct) => database.IdentityRoleBy("normalized_name", name);
}
