using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using MySqlConnector;
using Thesamenot.Api;

internal static partial class LocalBackupWorkflow
{
    [GeneratedRegex("^restore_[a-f0-9]{12}_test$")] private static partial Regex RestoreName();
    public static async Task Run(IConfiguration configuration, string root, bool apply)
    {
        if (!OperatingSystem.IsWindows()) throw new InvalidOperationException("This local backup workflow uses the owner's Windows DPAPI. Use the production restore runbook on other hosts.");
        var source = new MySqlConnectionStringBuilder(configuration.GetConnectionString("Store") ?? throw new InvalidOperationException("Missing store configuration."));
        if (source.Server != "127.0.0.1" || source.Port != 13307 || source.Database != "thesamenot_test")
            throw new InvalidOperationException("This workflow is restricted to the local thesamenot_test at 127.0.0.1:13307.");
        root = Path.GetFullPath(root);
        var elapsed = Stopwatch.StartNew();
        var sourceDatabase = new StoreDatabase(configuration);
        await using var db = await sourceDatabase.Open();
        await Quiesced(db);
        var stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + "-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
        var directory = Path.Combine(root, ".local", "backups", stamp); Directory.CreateDirectory(directory);
        var configPath = Path.Combine(directory, "client.cnf");
        var restore = "restore_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(6)).ToLowerInvariant() + "_test";
        if (!RestoreName().IsMatch(restore)) throw new InvalidOperationException("Invalid restore database.");
        var bin = configuration["Maintenance:MariaDbBin"] ?? @"C:\Program Files\MariaDB 10.11\bin";
        var protector = DataProtectionProvider.Create(new DirectoryInfo(Path.Combine(root, ".local", "backup-keys")),
            builder => { if (OperatingSystem.IsWindows()) builder.SetApplicationName("thesamenot-backups").ProtectKeysWithDpapi(); }).CreateProtector("database-dump-v1");
        static string Escape(string value) => "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r") + "\"";
        await File.WriteAllTextAsync(configPath, "[client]\nhost=127.0.0.1\nport=13307\nuser=" + Escape(source.UserID) + "\npassword=" + Escape(source.Password) + "\nprotocol=tcp\n");
        var created = false;
        try
        {
            var fingerprint = await Fingerprints(db);
            var dump = await Process(Path.Combine(bin, "mariadb-dump.exe"),
                ["--defaults-extra-file=" + configPath, "--host=127.0.0.1", "--port=13307", "--protocol=tcp", "--single-transaction", "--skip-comments", "--skip-dump-date", "--hex-blob", "--routines", "--triggers", "--events", "--no-tablespaces", source.Database]);
            var backupPath = Path.Combine(directory, "database.sql.protected");
            await File.WriteAllBytesAsync(backupPath, protector.Protect(dump));
            var restoredBytes = protector.Unprotect(await File.ReadAllBytesAsync(backupPath));
            if (!CryptographicOperations.FixedTimeEquals(SHA256.HashData(dump), SHA256.HashData(restoredBytes))) throw new InvalidOperationException("Encrypted backup verification failed.");
            await db.ExecuteAsync("CREATE DATABASE " + restore + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); created = true;
            await Process(Path.Combine(bin, "mariadb.exe"), ["--defaults-extra-file=" + configPath, "--host=127.0.0.1", "--port=13307", "--protocol=tcp", restore], restoredBytes);
            var cloned = new MySqlConnectionStringBuilder(source.ConnectionString) { Database = restore };
            await using var verify = new MySqlConnection(cloned.ConnectionString); await verify.OpenAsync();
            var fingerprints = await Fingerprints(verify);
            if (JsonSerializer.Serialize(fingerprint) != JsonSerializer.Serialize(fingerprints)) throw new InvalidOperationException("Restored table fingerprints differ from the source.");
            var keyPath = configuration["Auth:KeyRingPath"] ?? throw new InvalidOperationException("A persistent key ring is required.");
            var keyBackup = Path.Combine(directory, "auth-keys"); Directory.CreateDirectory(keyBackup);
            foreach (var file in Directory.GetFiles(Path.GetFullPath(keyPath), "*.xml")) File.Copy(file, Path.Combine(keyBackup, Path.GetFileName(file)));
            var originalProvider = DataProtectionProvider.Create(new DirectoryInfo(Path.GetFullPath(keyPath)), builder => { if (OperatingSystem.IsWindows()) builder.SetApplicationName("thesamenot").ProtectKeysWithDpapi(); });
            var probe = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            var protectedProbe = originalProvider.CreateProtector("restore-probe").Protect(probe);
            foreach (var file in Directory.GetFiles(Path.GetFullPath(keyPath), "*.xml")) File.Copy(file, Path.Combine(keyBackup, Path.GetFileName(file)), true);
            var copiedProvider = DataProtectionProvider.Create(new DirectoryInfo(keyBackup), builder => { if (OperatingSystem.IsWindows()) builder.SetApplicationName("thesamenot").ProtectKeysWithDpapi(); });
            if (copiedProvider.CreateProtector("restore-probe").Unprotect(protectedProbe) != probe) throw new InvalidOperationException("Restored key ring cannot decrypt the probe.");
            var mfa = (await verify.QueryAsync<string>("SELECT protected_key FROM user_mfa")).ToList();
            foreach (var value in mfa) if (string.IsNullOrWhiteSpace(copiedProvider.CreateProtector("thesamenot.mfa.v1").Unprotect(value))) throw new InvalidOperationException("Restored MFA key is invalid.");
            var cloneSettings = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { { "ConnectionStrings:Store", cloned.ConnectionString } }).Build();
            var rehearsal = new StoreDatabase(cloneSettings);
            var pending = await rehearsal.Migrate(Path.Combine(root, "backend", "Thesamenot.Api"));
            await rehearsal.VerifyIdentitySchema();
            await rehearsal.VerifyRuntimeSchema(Path.Combine(root, "backend", "Thesamenot.Api"));
            await Quiesced(db);
            if (JsonSerializer.Serialize(fingerprint) != JsonSerializer.Serialize(await Fingerprints(db))) throw new InvalidOperationException("Source changed during backup verification. Stop writers and repeat.");
            var applied = apply ? await sourceDatabase.Migrate(Path.Combine(root, "backend", "Thesamenot.Api")) : 0;
            if (apply) await sourceDatabase.VerifyRuntimeSchema(Path.Combine(root, "backend", "Thesamenot.Api"));
            await File.WriteAllTextAsync(Path.Combine(directory, "verification.json"), JsonSerializer.Serialize(new
            {
                completedUtc = DateTime.UtcNow,
                source = "127.0.0.1:13307/thesamenot_test",
                backup = "database.sql.protected",
                tableFingerprints = fingerprint,
                keyRingRestored = true,
                mfaKeysRestored = mfa.Count,
                rehearsedMigrations = pending,
                appliedMigrations = applied,
                elapsedMilliseconds = elapsed.ElapsedMilliseconds
            }, new JsonSerializerOptions { WriteIndented = true }));
            Console.WriteLine("Encrypted backup, isolated SQL restore, table fingerprints and copied key-ring/MFA checks passed.");
            Console.WriteLine("Rehearsed migrations: " + pending + ". Applied to local store: " + applied + ".");
            Console.WriteLine("Private backup directory: " + directory);
        }
        finally
        {
            File.Delete(configPath);
            if (created && RestoreName().IsMatch(restore)) await db.ExecuteAsync("DROP DATABASE " + restore);
        }
    }
    private static async Task Quiesced(MySqlConnection db)
    {
        if (await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE DB=DATABASE() AND ID<>CONNECTION_ID()") != 0)
            throw new InvalidOperationException("The store still has database connections. Stop its backend before local migration; no process was stopped.");
        var listeners = System.Net.NetworkInformation.IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners();
        if (listeners.Any(endpoint => endpoint.Port is 3000 or 5080)) throw new InvalidOperationException("A local development service is running. Stop it before the verified migration; no process was stopped.");
    }
    private static async Task<SortedDictionary<string, string>> Fingerprints(MySqlConnection db)
    {
        var result = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var table in await db.QueryAsync<string>("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"))
        {
            var escaped = "\u0060" + table.Replace("\u0060", "\u0060\u0060") + "\u0060";
            var rows = (await db.QueryAsync("SELECT * FROM " + escaped)).Select(row => JsonSerializer.Serialize((IDictionary<string, object>)row)).Order(StringComparer.Ordinal);
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            var count = 0;
            foreach (var row in rows) { var bytes = Encoding.UTF8.GetBytes(row); hash.AppendData(BitConverter.GetBytes(bytes.Length)); hash.AppendData(bytes); count++; }
            result[table] = count + ":" + Convert.ToHexString(hash.GetHashAndReset());
        }
        return result;
    }
    private static async Task<byte[]> Process(string executable, string[] arguments, byte[]? input = null)
    {
        var start = new ProcessStartInfo(executable) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = input is not null };
        foreach (var argument in arguments) start.ArgumentList.Add(argument);
        using var process = System.Diagnostics.Process.Start(start) ?? throw new InvalidOperationException("Database utility unavailable.");
        using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(2));
        using var output = new MemoryStream();
        try
        {
            var read = process.StandardOutput.BaseStream.CopyToAsync(output, timeout.Token);
            var error = process.StandardError.ReadToEndAsync(timeout.Token);
            if (input is not null) { await process.StandardInput.BaseStream.WriteAsync(input, timeout.Token); process.StandardInput.Close(); }
            await Task.WhenAll(read, process.WaitForExitAsync(timeout.Token), error);
            if (process.ExitCode != 0)
            {
                var diagnostic = await error;
                var code = Regex.Match(diagnostic, @"(?i)(?:ERROR|Error)\s+(\d+)").Groups[1].Value;
                var category = diagnostic.Contains("denied", StringComparison.OrdinalIgnoreCase) ? "permission denied" :
                    diagnostic.Contains("unknown", StringComparison.OrdinalIgnoreCase) ? "unsupported option or setting" : "utility failure";
                throw new InvalidOperationException(Path.GetFileName(executable) + ": " + category + (code.Length > 0 ? " (code " + code + ")" : "") + ". No credentials or SQL output were logged.");
            }
            return output.ToArray();
        }
        catch { if (!process.HasExited) process.Kill(true); throw; }
    }
}
