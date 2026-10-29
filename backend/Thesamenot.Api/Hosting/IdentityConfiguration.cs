using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Thesamenot.Api.Security;
using Thesamenot.Api.Security.Identity;
using Thesamenot.Api.Services;

namespace Thesamenot.Api.Hosting;

public static class IdentityConfiguration
{
    public static IServiceCollection AddStoreIdentity(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddIdentityCore<StoreUser>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.User.AllowedUserNameCharacters = "";
            options.Password.RequiredLength = StorePasswordValidator.MinimumLength;
            // StorePasswordValidator enforces all four character classes with Unicode
            // categories, matching the browser instead of the default ASCII-only checks.
            options.Password.RequireDigit = false;
            options.Password.RequireLowercase = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        }).AddRoles<StoreRole>().AddUserStore<DapperUserStore>().AddRoleStore<DapperRoleStore>()
          .AddDefaultTokenProviders();
        services.AddSingleton<StorePasswordValidator>();
        services.AddSingleton<IPasswordValidator<StoreUser>>(provider => provider.GetRequiredService<StorePasswordValidator>());
        services.Configure<PasswordHasherOptions>(options => options.IterationCount = 210000);
        services.AddScoped<AuthenticationService>();
        services.AddSingleton<RegistrationContinuation>();
        services.AddScoped<SessionValidation>();
        services.AddSingleton<EmailService>();
        services.AddScoped<OrderAccessService>();
        if (configuration.GetValue("Workers:Enabled", true)) services.AddHostedService(provider => provider.GetRequiredService<EmailService>());
        return services;
    }

    public static void ConfigureStoreKeyRing(this IServiceCollection services, IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        var path = configuration["Auth:KeyRingPath"];
        if (string.IsNullOrWhiteSpace(path))
        {
            if (!environment.IsDevelopment()) throw new InvalidOperationException("A persistent Auth:KeyRingPath is required.");
            path = Path.Combine(environment.ContentRootPath, ".local", "auth-keys");
        }
        var protection = services.AddDataProtection().SetApplicationName("thesamenot")
            .PersistKeysToFileSystem(new DirectoryInfo(Path.GetFullPath(path)));
        var certificatePath = configuration["Auth:KeyEncryptionCertificatePath"];
        if (!string.IsNullOrWhiteSpace(certificatePath))
        {
            var certificate = X509CertificateLoader.LoadPkcs12FromFile(certificatePath,
                configuration["Auth:KeyEncryptionCertificatePassword"]);
            if (!certificate.HasPrivateKey || certificate.NotAfter.ToUniversalTime() <= DateTime.UtcNow ||
                certificate.NotBefore.ToUniversalTime() > DateTime.UtcNow)
                throw new InvalidOperationException("Key encryption requires a valid certificate with a private key.");
            protection.ProtectKeysWithCertificate(certificate);
        }
        else if (environment.IsDevelopment() && OperatingSystem.IsWindows()) protection.ProtectKeysWithDpapi();
        else if (!environment.IsDevelopment())
            throw new InvalidOperationException(environment.IsProduction() ? "Production requires key encryption at rest." : "Hosted accounts require key encryption at rest.");
    }
}
