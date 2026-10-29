using System.Diagnostics;
using System.Text.RegularExpressions;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace Thesamenot.Api.Services;

// The random key is the only accepted storage path. Object storage credentials never reach the browser.
public sealed partial class ProductMediaService : IDisposable
{
    private readonly IConfiguration configuration;
    private readonly string root;
    private readonly string sharp;
    private readonly string worker;
    private readonly AmazonS3Client? s3;
    private readonly bool disabled;
    private readonly SemaphoreSlim processors = new(2, 2);
    [GeneratedRegex("^[a-f0-9]{32}[.]webp$")] private static partial Regex KeyPattern();
    public ProductMediaService(IConfiguration config, IWebHostEnvironment env)
    {
        configuration = config;
        root = Path.GetFullPath(config["Media:LocalDirectory"] ?? Path.Combine(env.ContentRootPath, "../../.local/media"));
        sharp = Path.GetFullPath(config["Media:SharpModule"] ?? Path.Combine(env.ContentRootPath, "../../frontend/node_modules/sharp"));
        worker = Path.Combine(env.ContentRootPath, "Media", "process-image.mjs");
        var mode = config["Media:Mode"] ?? (env.IsDevelopment() ? "Local" : "Disabled");
        if (mode == "S3")
        {
            if (!Uri.TryCreate(config["Media:Endpoint"], UriKind.Absolute, out var endpoint) || endpoint.Scheme != "https" ||
                string.IsNullOrWhiteSpace(config["Media:Bucket"]) || string.IsNullOrWhiteSpace(config["Media:AccessKey"]) || string.IsNullOrWhiteSpace(config["Media:SecretKey"]))
                throw new InvalidOperationException("S3 media requires a private bucket, HTTPS endpoint and credentials.");
            s3 = new AmazonS3Client(new BasicAWSCredentials(config["Media:AccessKey"], config["Media:SecretKey"]),
                new AmazonS3Config { ServiceURL = endpoint.ToString(), ForcePathStyle = true, AuthenticationRegion = config["Media:Region"] ?? "us-east-1", MaxErrorRetry = 2 });
        }
        else if (mode == "Disabled" && !env.IsProduction()) disabled = true;
        else if (mode != "Local" || !env.IsDevelopment()) throw new InvalidOperationException("Production media requires persistent S3-compatible storage; local media is Development-only.");
    }
    public async Task<(string Key, int Width, int Height)> Upload(Stream source, string mime, CancellationToken ct)
    {
        if (disabled) throw new StoreException(503, "Persistent image storage is not configured for this deployment.");
        if (mime is not ("image/jpeg" or "image/png" or "image/webp")) throw new StoreException(400, "Upload a JPEG, PNG or WebP image.");
        if (!await processors.WaitAsync(0, ct)) throw new StoreException(429, "Image processing is busy. Retry shortly.", 2);
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(15));
            var info = new ProcessStartInfo(configuration["Media:NodeExecutable"] ?? "node") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true };
            info.ArgumentList.Add(worker); info.ArgumentList.Add(mime);
            info.Environment["STORE_SHARP_MODULE"] = sharp;
            using var process = Process.Start(info) ?? throw new InvalidOperationException("Image processor unavailable.");
            using var output = new MemoryStream();
            try
            {
                var write = Task.Run(async () =>
                {
                    await CopyLimited(source, process.StandardInput.BaseStream, 6 * 1024 * 1024, timeout.Token);
                    process.StandardInput.Close();
                }, timeout.Token);
                var read = CopyLimited(process.StandardOutput.BaseStream, output, 8 * 1024 * 1024, timeout.Token);
                var errors = process.StandardError.ReadToEndAsync(timeout.Token);
                await Task.WhenAll(write, read, process.WaitForExitAsync(timeout.Token), errors);
                if (process.ExitCode != 0 || output.Length < 20) throw new StoreException(400, "Invalid image. Maximum 6 MB, 4096 pixels per side and 12 megapixels; animations are not accepted.");
            }
            catch
            {
                if (!process.HasExited) process.Kill(true);
                throw;
            }
            var bytes = output.ToArray();
            var key = Guid.NewGuid().ToString("N") + ".webp";
            using var image = new MemoryStream(bytes, 8, bytes.Length - 8, false);
            if (s3 is not null) await s3.PutObjectAsync(new PutObjectRequest { BucketName = configuration["Media:Bucket"], Key = key, InputStream = image, ContentType = "image/webp", AutoCloseStream = false }, ct);
            else
            {
                Directory.CreateDirectory(root);
                await using var target = new FileStream(Path.Combine(root, key), FileMode.CreateNew, FileAccess.Write, FileShare.None);
                await image.CopyToAsync(target, ct);
            }
            return (key, BitConverter.ToInt32(bytes, 0), BitConverter.ToInt32(bytes, 4));
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new StoreException(400, "Image processing timed out.");
        }
        finally { processors.Release(); }
    }
    private static async Task CopyLimited(Stream input, Stream output, int limit, CancellationToken ct)
    {
        var buffer = new byte[65536]; var total = 0;
        for (int size; (size = await input.ReadAsync(buffer, ct)) > 0;)
        {
            total = checked(total + size); if (total > limit) throw new StoreException(413, "Image is too large.");
            await output.WriteAsync(buffer.AsMemory(0, size), ct);
        }
    }
    public async Task<byte[]> Read(string key, CancellationToken ct)
    {
        if (disabled) throw new StoreException(404, "Image not found.");
        if (!KeyPattern().IsMatch(key)) throw new StoreException(404, "Image not found.");
        if (s3 is not null)
        {
            using var response = await s3.GetObjectAsync(configuration["Media:Bucket"], key, ct);
            using var output = new MemoryStream(); await CopyLimited(response.ResponseStream, output, 8 * 1024 * 1024, ct); return output.ToArray();
        }
        var path = Path.Combine(root, key);
        if (!File.Exists(path)) throw new StoreException(404, "Image not found.");
        return await File.ReadAllBytesAsync(path, ct);
    }
    public async Task Delete(string key, CancellationToken ct)
    {
        if (!KeyPattern().IsMatch(key)) throw new InvalidOperationException("Invalid media key.");
        if (s3 is not null) await s3.DeleteObjectAsync(configuration["Media:Bucket"], key, ct);
        else File.Delete(Path.Combine(root, key));
    }
    public void Dispose() { s3?.Dispose(); processors.Dispose(); }
}
