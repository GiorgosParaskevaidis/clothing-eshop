using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using MySqlConnector;

internal static class PreviewConfiguration
{
    public static async Task WriteAsync(string root, string credentialsPath)
    {
        var local = Path.Combine(root, ".local");
        Directory.CreateDirectory(local);
        var settingsPath = Path.Combine(local, "render-preview-settings.json");
        var accessPath = Path.Combine(local, "render-preview-access.txt");
        if (File.Exists(settingsPath) != File.Exists(accessPath))
            throw new InvalidOperationException("Preview configuration is incomplete. Restore both settings and access files before continuing.");
        var credentials = JsonSerializer.Deserialize<DatabaseCredentials>(await File.ReadAllTextAsync(credentialsPath),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? throw new InvalidOperationException("Missing credentials.");
        if (string.IsNullOrWhiteSpace(credentials.Password)) throw new InvalidOperationException("Missing database password.");
        var connection = new MySqlConnectionStringBuilder {
            Server = credentials.Host, Port = credentials.Port, Database = credentials.Database,
            UserID = credentials.User, Password = credentials.Password,
            SslMode = MySqlSslMode.VerifyFull, MaximumPoolSize = 3
        };
        var certificatePath = Path.Combine(local, "filess-certificate.json");
        string? certificatePin = null;
        if (File.Exists(certificatePath))
        {
            using var certificate = JsonDocument.Parse(await File.ReadAllTextAsync(certificatePath));
            certificatePin = certificate.RootElement.GetProperty("sha256").GetString();
            if (Convert.FromHexString(certificatePin ?? "").Length != 32)
                throw new InvalidOperationException("Invalid certificate fingerprint.");
            connection.SslMode = MySqlSslMode.Required;
        }
        var email = "admin@thesamenot.preview";
        var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        var settings = new Dictionary<string,string> {
            ["ConnectionStrings__Store"] = connection.ConnectionString,
            ["Admin__Email"] = email,
            ["Admin__PasswordHash"] = new PasswordHasher<string>().HashPassword(email,password),
            ["Database__Initialize"] = "true",
            ["ASPNETCORE_ENVIRONMENT"] = "Preview"
        };
        if (File.Exists(settingsPath))
        {
            var existing = JsonSerializer.Deserialize<Dictionary<string,string>>(await File.ReadAllTextAsync(settingsPath))!;
            settings["Admin__Email"] = existing["Admin__Email"];
            settings["Admin__PasswordHash"] = existing["Admin__PasswordHash"];
            settings["Database__Initialize"] = existing["Database__Initialize"];
        }
        if (certificatePin is not null) settings["Database__ServerCertificateSha256"] = certificatePin;
        await File.WriteAllTextAsync(settingsPath, JsonSerializer.Serialize(settings,new JsonSerializerOptions {WriteIndented=true}));
        await File.WriteAllLinesAsync(Path.Combine(local,"render-preview.env"), settings.Select(x => x.Key + "=" + x.Value));
        if (!File.Exists(accessPath)) await File.WriteAllTextAsync(accessPath,$"Email: {email}\nPassword: {password}\nRemote preview only. Do not commit or share this file.\n");
        Console.WriteLine("Preview configuration saved under .local. No secrets printed; no database changes made.");
    }
    private sealed record DatabaseCredentials(string Host,uint Port,string Database,string User,string Password);
}