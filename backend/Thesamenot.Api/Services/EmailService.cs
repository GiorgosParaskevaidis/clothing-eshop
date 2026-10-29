using System.Text.Json;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Thesamenot.Api.Services;

public sealed class EmailService(IConfiguration configuration, IWebHostEnvironment environment, ILogger<EmailService> logger, StoreDatabase database) : BackgroundService
{
    public async Task Send(string email, string purpose, string? token = null, CancellationToken ct = default)
    {
        var id = await database.EnqueueEmail(new EmailJob(email, purpose, token));
        if (configuration["Email:Mode"] == "DevelopmentFile" && environment.IsDevelopment())
        {
            var job = await database.LeaseJob("email", id);
            if (job is not null) await Process(job, ct);
        }
    }
    public async Task FlushDevelopmentKey(string key, CancellationToken ct = default)
    {
        if (configuration["Email:Mode"] != "DevelopmentFile" || !environment.IsDevelopment()) return;
        var id = await database.JobIdByKey(key);
        if (id is not null)
        {
            var job = await database.LeaseJob("email", id);
            if (job is not null) await Process(job, ct);
        }
    }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(2));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try { for (var i = 0; i < 20; i++) { var job = await database.LeaseJob("email"); if (job is null) break; await Process(job, stoppingToken); } }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { logger.LogWarning("Email outbox processing will retry ({Code}).", error is MySqlConnector.MySqlException sql ? "database_" + sql.Number : error.GetType().Name); }
        }
    }
    private async Task Process(StoreJob job, CancellationToken ct)
    {
        try { await Deliver(database.JobPayload<EmailJob>(job), job.Id, ct); await database.FinishJob(job); }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch { await database.FinishJob(job, "smtp_delivery_failed"); }
    }
    private async Task Deliver(EmailJob delivery, string id, CancellationToken ct)
    {
        var (email, purpose, token, text) = delivery;
        var page = purpose switch
        {
            "verify-email" => "/account/verify-email",
            "reset-password" => "/account/reset-password",
            "change-email" => "/account/verify-email",
            "order-access" or "order-claim" => "/order-access",
            "newsletter-confirm" => "/newsletter/confirm",
            "newsletter-unsubscribe" => "/unsubscribe",
            _ => ""
        };
        var link = token is null ? null : configuration["Store:PublicUrl"]!.TrimEnd('/') + page +
            "#token=" + Uri.EscapeDataString(token) + "&purpose=" + Uri.EscapeDataString(purpose);
        try
        {
            if (configuration["Email:Mode"] == "DevelopmentFile" && environment.IsDevelopment())
            {
                var directory = configuration["Email:Directory"] ?? throw new InvalidOperationException("Missing development mail directory.");
                Directory.CreateDirectory(directory);
                await File.WriteAllTextAsync(Path.Combine(directory, id + ".json"),
                    JsonSerializer.Serialize(new { email, purpose, link, text, createdUtc = DateTime.UtcNow }), ct);
                return;
            }
            if (configuration["Email:Mode"] != "Smtp") throw new InvalidOperationException("Email provider is not configured.");
            var message = new MimeMessage();
            message.MessageId = id + "@" + MailboxAddress.Parse(configuration["Email:FromAddress"]!).Address.Split('@').Last();
            message.From.Add(MailboxAddress.Parse(configuration["Email:FromAddress"]!));
            message.To.Add(MailboxAddress.Parse(email));
            message.Subject = "thesamenot — " + (purpose switch
            {
                "order-created-admin" => "Νέα παραγγελία",
                "order-created" => "Order confirmation",
                _ => purpose
            });
            message.Body = new TextPart("plain")
            {
                Text = text ?? (link is null
                ? "Your thesamenot account security settings changed. If this was not you, contact the store."
                : "Use this link to continue. It expires and can only be used once.\n\n" + link + "\n\nIf you did not request this, ignore this message.")
            };
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(15));
            using var smtp = new SmtpClient { Timeout = 15000 };
            var port = configuration.GetValue("Email:Port", 587);
            await smtp.ConnectAsync(configuration["Email:Host"] ?? throw new InvalidOperationException("Missing SMTP host."), port,
                port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, timeout.Token);
            var username = configuration["Email:Username"];
            if (!string.IsNullOrWhiteSpace(username)) await smtp.AuthenticateAsync(username, configuration["Email:Password"] ?? "", timeout.Token);
            await smtp.SendAsync(message, timeout.Token);
            await smtp.DisconnectAsync(true, timeout.Token);
        }
        catch
        {
            // No addresses, tokens, SMTP credentials or provider response are written to application logs.
            logger.LogWarning("Email dispatch failed for purpose {Purpose}.", purpose);
            throw;
        }
    }
}
