using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using MySqlConnector;

namespace Thesamenot.Api;

public static class StoreConnectionFactory
{
    public static MySqlConnection Create(IConfiguration configuration)
    {
        var value = configuration.GetConnectionString("Store");
        if (string.IsNullOrWhiteSpace(value))
            throw new StoreException(503, "The store is temporarily unavailable.");
        var pin = configuration["Database:ServerCertificateSha256"];
        var connection = new MySqlConnection(value);
        if (string.IsNullOrWhiteSpace(pin)) return connection;

        var expected = Convert.FromHexString(pin);
        if (expected.Length != 32 || new MySqlConnectionStringBuilder(value).SslMode != MySqlSslMode.Required)
            throw new InvalidOperationException("Certificate pinning requires a SHA-256 fingerprint and SslMode=Required.");
        connection.RemoteCertificateValidationCallback = (_, certificate, _, _) =>
        {
            if (certificate is not X509Certificate2 server) return false;
            var now = DateTime.UtcNow;
            return now >= server.NotBefore.ToUniversalTime() && now <= server.NotAfter.ToUniversalTime() &&
                CryptographicOperations.FixedTimeEquals(expected, server.GetCertHash(HashAlgorithmName.SHA256));
        };
        return connection;
    }
}