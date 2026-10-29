using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;

namespace Thesamenot.Api.Security.Identity;

public sealed class StorePasswordValidator(IConfiguration configuration) : IPasswordValidator<StoreUser>
{
    public const int MinimumLength = 8;
    public const int MaximumLength = 128;
    public const string Description = "Use 8–128 characters with an uppercase letter, a lowercase letter, a number and a symbol. Avoid common or compromised passwords.";
    private readonly HashSet<string> blocked = Load(configuration);
    private static HashSet<string> Load(IConfiguration configuration)
    {
        string[] common = ["passwordpassword","PasswordPassword1!","123456789012345","1234567890123456",
            "qwertyuiopasdfgh","abcdefghijklmnop","correct horse battery staple","thesamenotthesamenot",
            "Password1!","Password123!","Welcome1!","Qwerty1!","Aa123456!"];
        var result = common.Select(Hash).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var file = configuration["Auth:CompromisedPasswordHashesPath"];
        if (!string.IsNullOrWhiteSpace(file))
        {
            var count = 0;
            foreach (var line in File.ReadLines(file).Where(x => !string.IsNullOrWhiteSpace(x)))
            {
                if (line.Length != 64 || !line.All(Uri.IsHexDigit)) throw new InvalidOperationException("Invalid password blocklist format.");
                result.Add(line);
                count++;
            }
            if (count == 0) throw new InvalidOperationException("The configured password blocklist is empty.");
        }
        return result;
    }
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static bool MeetsComposition(string? password)
    {
        var characters = password?.EnumerateRunes().ToArray() ?? [];
        return characters.Length is >= MinimumLength and <= MaximumLength &&
            characters.Any(Rune.IsUpper) && characters.Any(Rune.IsLower) &&
            characters.Any(Rune.IsDigit) &&
            characters.Any(character => Rune.IsPunctuation(character) || Rune.IsSymbol(character));
    }
    public Task<IdentityResult> ValidateAsync(UserManager<StoreUser> manager, StoreUser user, string? password)
    {
        var valid = MeetsComposition(password) && !blocked.Contains(Hash(password!));
        return Task.FromResult(valid ? IdentityResult.Success : IdentityResult.Failed(new IdentityError
        {
            Code = "PasswordPolicy",
            Description = Description
        }));
    }
}
