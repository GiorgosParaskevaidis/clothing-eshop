using System.Text.Json.Nodes;
using Dapper;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;
using Thesamenot.Api;
using Thesamenot.Api.Hosting;
using Thesamenot.Api.Security.Identity;
using Thesamenot.Api.Validation;

string Option(string name, string fallback = "")
{
    var index = Array.IndexOf(args, name);
    return index >= 0 && index + 1 < args.Length ? args[index + 1] : fallback;
}
string Secret()
{
    var value = Environment.GetEnvironmentVariable("STORE_ADMIN_PASSWORD");
    if (!string.IsNullOrEmpty(value)) return value;
    if (Console.IsInputRedirected) throw new InvalidOperationException("Set STORE_ADMIN_PASSWORD through a private environment, never a command argument.");
    Console.Write("Admin password (hidden): ");
    var chars = new List<char>();
    while (true)
    {
        var key = Console.ReadKey(true);
        if (key.Key == ConsoleKey.Enter) break;
        if (key.Key == ConsoleKey.Backspace) { if (chars.Count > 0) chars.RemoveAt(chars.Count - 1); }
        else if (!char.IsControl(key.KeyChar)) chars.Add(key.KeyChar);
    }
    Console.WriteLine();
    return new string(chars.ToArray());
}
try
{
    DefaultTypeMap.MatchNamesWithUnderscores = true;
    var settingsPath = Path.GetFullPath(Option("--settings", "backend/Thesamenot.Api/appsettings.Local.json"));
    var configuration = new ConfigurationBuilder().AddJsonFile(settingsPath).AddEnvironmentVariables().Build();
    var database = new StoreDatabase(configuration);
    switch (args.FirstOrDefault())
    {
        case "verify-tax-contract":
            TaxContractChecks.Run();
            break;
        case "verify-payment-contract":
            await PaymentContractChecks.Run(configuration);
            break;
        case "backup-verify-local":
        case "migrate-local-verified":
            await LocalBackupWorkflow.Run(configuration, Path.GetFullPath(Option("--root", Directory.GetCurrentDirectory())), args[0] == "migrate-local-verified");
            break;
        case "migrate":
            var contentRoot = Path.Combine(Path.GetFullPath(Option("--root", Directory.GetCurrentDirectory())), "backend", "Thesamenot.Api");
            Console.WriteLine("Applied migrations: " + await database.Migrate(contentRoot));
            break;
        case "bootstrap-admin":
            await database.VerifyIdentitySchema();
            var email = Option("--email", Environment.GetEnvironmentVariable("STORE_ADMIN_EMAIL") ?? "");
            if (string.IsNullOrWhiteSpace(email) && !Console.IsInputRedirected) { Console.Write("Admin email: "); email = Console.ReadLine() ?? ""; }
            email = AuthValidation.Email(email);
            var password = Secret();
            var services = new ServiceCollection().AddLogging().AddSingleton<IConfiguration>(configuration).AddSingleton(database);
            services.AddDataProtection();
            services.AddStoreIdentity(configuration);
            using (var provider = services.BuildServiceProvider())
            using (var scope = provider.CreateScope())
            {
                var users = scope.ServiceProvider.GetRequiredService<UserManager<StoreUser>>();
                var user = new StoreUser
                {
                    UserName = email,
                    Email = email,
                    EmailConfirmed = true,
                    DisplayName = "Store administrator",
                    NormalizedEmail = users.NormalizeEmail(email),
                    NormalizedUserName = users.NormalizeName(email)
                };
                foreach (var validator in users.PasswordValidators)
                    if (!(await validator.ValidateAsync(users, user, password)).Succeeded)
                        throw new InvalidOperationException(StorePasswordValidator.Description);
                user.PasswordHash = scope.ServiceProvider.GetRequiredService<IPasswordHasher<StoreUser>>().HashPassword(user, password);
                if (!(await database.CreateIdentityUser(user, bootstrapAdmin: true)).Succeeded)
                    throw new InvalidOperationException("Admin bootstrap refused: an admin or the address already exists.");
            }
            Console.WriteLine("Admin created. First sign in requires authenticator enrollment. No password was saved in settings.");
            break;
        case "fixture-legacy":
            var connection = new MySqlConnectionStringBuilder(configuration.GetConnectionString("Store") ?? throw new InvalidOperationException("Missing database configuration."));
            if (connection.Server != "127.0.0.1" || connection.Port != 13307 ||
                !System.Text.RegularExpressions.Regex.IsMatch(connection.Database, "^phase1_[a-f0-9]{12}_test$"))
                throw new InvalidOperationException("Legacy fixture command is restricted to an isolated local test database.");
            var fixtureEmail = Environment.GetEnvironmentVariable("STORE_ADMIN_EMAIL") ?? throw new InvalidOperationException("Missing fixture email.");
            var document = JsonNode.Parse(await File.ReadAllTextAsync(settingsPath))!;
            document["Admin"] = new JsonObject { ["Email"] = fixtureEmail, ["PasswordHash"] = new PasswordHasher<string>().HashPassword(fixtureEmail, Secret()) };
            await File.WriteAllTextAsync(settingsPath, document.ToJsonString());
            Console.WriteLine("Isolated legacy fixture configured.");
            break;
        default:
            throw new InvalidOperationException("Commands: migrate --settings <file> --root <project>; bootstrap-admin --settings <file> --email <email>.");
    }
}
catch (Exception exception)
{
    Console.Error.WriteLine(exception is InvalidOperationException or StoreException ? exception.Message :
        "Maintenance failed (" + exception.GetType().Name + (exception is MySqlException sql ? "/" + sql.Number : "") + "). Check configuration and database permissions.");
    Environment.ExitCode = 1;
}
