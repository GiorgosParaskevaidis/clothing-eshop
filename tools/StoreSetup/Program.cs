using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using MySqlConnector;

string Argument(string name,string fallback){var i=Array.IndexOf(args,name);return i>=0&&i+1<args.Length?args[i+1]:fallback;}
string Prompt(string label,string fallback){Console.Write($"{label} [{fallback}]: ");var value=Console.ReadLine();return string.IsNullOrWhiteSpace(value)?fallback:value;}
string Secret(string label){Console.Write(label+": ");if(Console.IsInputRedirected)return Console.ReadLine()??"";var value="";while(true){var key=Console.ReadKey(true);if(key.Key==ConsoleKey.Enter)break;if(key.Key==ConsoleKey.Backspace){if(value.Length>0)value=value[..^1];}else if(!char.IsControl(key.KeyChar))value+=key.KeyChar;}Console.WriteLine();return value;}
var unattended=args.Contains("--non-interactive");
var root=Path.GetFullPath(Argument("--root",Path.Combine(Directory.GetCurrentDirectory(),"..","..")));
var configPath=Path.Combine(root,"backend","Thesamenot.Api","appsettings.Local.json");
if(File.Exists(configPath))throw new InvalidOperationException("Local configuration already exists. Back it up and rename it before running setup. No database changes were made.");
var host=unattended?Argument("--host","127.0.0.1"):Prompt("MariaDB host","127.0.0.1");
var port=uint.Parse(unattended?Argument("--port","3306"):Prompt("MariaDB port","3306"));
var dbName=unattended?Argument("--database","thesamenot_test"):Prompt("New database name","thesamenot");
if(!System.Text.RegularExpressions.Regex.IsMatch(dbName,"^[a-z][a-z0-9_]{1,40}$"))throw new InvalidOperationException("Use lowercase letters, digits and underscores for the database name.");
var rootUser=unattended?Argument("--user","root"):Prompt("MariaDB user with CREATE privileges","root");
var rootPassword=unattended?Environment.GetEnvironmentVariable("STORE_SETUP_DB_PASSWORD")??"":Secret("MariaDB password (not saved)");
var email=unattended?Argument("--admin-email","admin@thesamenot.local"):Prompt("Admin email","admin@thesamenot.local");
var adminPassword=unattended?Environment.GetEnvironmentVariable("STORE_SETUP_ADMIN_PASSWORD")??"":Secret("New admin password (at least 12 characters)");
if(adminPassword.Length<12)throw new InvalidOperationException("Admin password must have at least 12 characters.");
var connectionString=new MySqlConnectionStringBuilder {Server=host,Port=port,UserID=rootUser,Password=rootPassword};
await using var db=new MySqlConnection(connectionString.ConnectionString);await db.OpenAsync();
await using(var exists=new MySqlCommand("SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=@name",db)){exists.Parameters.AddWithValue("@name",dbName);if(Convert.ToInt32(await exists.ExecuteScalarAsync())!=0)throw new InvalidOperationException("This database already exists. Choose a new name; existing data will not be overwritten.");}
await using(var create=new MySqlCommand($"CREATE DATABASE `{dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",db))await create.ExecuteNonQueryAsync();
await db.ChangeDatabaseAsync(dbName);
var schema=await File.ReadAllTextAsync(Path.Combine(root,"backend","Thesamenot.Api","Database","schema.sql"));
await using(var command=new MySqlCommand(schema,db))await command.ExecuteNonQueryAsync();
var appUser=dbName+"_app";var appPassword=Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
// Account is confined to loopback, and can access only this newly created database.
foreach(var accountHost in new[]{"localhost","127.0.0.1"}){
    await using(var command=new MySqlCommand($"CREATE USER '{appUser}'@'{accountHost}' IDENTIFIED BY @password",db)){command.Parameters.AddWithValue("@password",appPassword);await command.ExecuteNonQueryAsync();}
    await using(var command=new MySqlCommand($"GRANT SELECT,INSERT,UPDATE,DELETE ON `{dbName}`.* TO '{appUser}'@'{accountHost}'",db))await command.ExecuteNonQueryAsync();
}
connectionString.UserID=appUser;connectionString.Password=appPassword;connectionString.Database=dbName;
var settings=new {
    ConnectionStrings=new {Store=connectionString.ConnectionString},
    Admin=new {Email=email,PasswordHash=new PasswordHasher<string>().HashPassword(email,adminPassword)},
    Store=new {PublicUrl=Argument("--public-url","http://localhost:3000"),SalesEnabled=true,PaymentMode="Simulation"}
};
await File.WriteAllTextAsync(configPath,JsonSerializer.Serialize(settings,new JsonSerializerOptions {WriteIndented=true}));
Console.WriteLine($"Created database {dbName} and local configuration. Admin email: {email}. Passwords were not printed. Simulation is Development-only.");
