using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace Thesamenot.Api.Security;

public static class Totp
{
    public static long? MatchingStep(string key, string code)
    {
        if (code.Length != 6 || !code.All(char.IsAsciiDigit)) return null;
        var bytes = new List<byte>(); var accumulator = 0; var bits = 0;
        foreach (var c in key.ToUpperInvariant())
        {
            var value = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".IndexOf(c);
            if (value < 0) continue;
            accumulator = (accumulator << 5) | value; bits += 5;
            if (bits >= 8) { bits -= 8; bytes.Add((byte)(accumulator >> bits)); }
        }
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        for (var step = now - 1; step <= now + 1; step++)
        {
            var counter = new byte[8]; BinaryPrimitives.WriteInt64BigEndian(counter, step);
            var hmac = HMACSHA1.HashData(bytes.ToArray(), counter);
            var offset = hmac[^1] & 15;
            var value = (BinaryPrimitives.ReadInt32BigEndian(hmac.AsSpan(offset, 4)) & int.MaxValue) % 1_000_000;
            if (CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(value.ToString("D6")), Encoding.ASCII.GetBytes(code))) return step;
        }
        return null;
    }
}
