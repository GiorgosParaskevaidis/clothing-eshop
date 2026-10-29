using Microsoft.AspNetCore.Identity;

namespace Thesamenot.Api.Security.Identity;

public sealed class StoreUser : IdentityUser
{
    public StoreUser()
    {
        Id = Guid.NewGuid().ToString("N");
        SecurityStamp = Guid.NewGuid().ToString("N");
        ConcurrencyStamp = Guid.NewGuid().ToString("N");
        LockoutEnabled = true;
    }
    public string DisplayName { get; set; } = "";
    public bool Enabled { get; set; } = true;
    public DateTime? LockoutEndUtc { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedUtc { get; set; } = DateTime.UtcNow;
}

public sealed class StoreRole : IdentityRole
{
    public StoreRole() { Id = Guid.NewGuid().ToString("N"); ConcurrencyStamp = Guid.NewGuid().ToString("N"); }
}

public sealed class ActionToken
{
    public string UserId { get; set; } = "";
    public string Purpose { get; set; } = "";
    public string SecurityStamp { get; set; } = "";
    public string? TargetEmail { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public DateTime? UsedUtc { get; set; }
    public int Attempts { get; set; }
}
