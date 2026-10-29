namespace Thesamenot.Api.Services;

public sealed class StoreJobRunner(StoreDatabase database, ILogger<StoreJobRunner> logger)
{
    public async Task Run(StoreJob job, Func<Task> action, CancellationToken stoppingToken)
    {
        using var lease = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
        var heartbeat = Task.Run(async () =>
        {
            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
            while (await timer.WaitForNextTickAsync(lease.Token))
                if (!await database.ExtendLease(job)) throw new InvalidOperationException("Job lease was lost.");
        }, lease.Token);
        try { await action(); await database.FinishJob(job); }
        catch (StoreException error) when (error.Status is 400 or 401 or 403 or 404)
        {
            var code = error.Message switch
            {
                "Unexpected payment currency." => "currency_mismatch",
                "Payment total does not match the order." => "amount_mismatch",
                _ => "business_rule_" + error.Status
            };
            await database.FinishJob(job, code, true);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { throw; }
        catch (Exception error)
        {
            var code = error is MySqlConnector.MySqlException sql ? "database_" + sql.Number : "failure_" + error.GetType().Name;
            logger.LogWarning("Job {Kind} will retry ({Code}).", job.Kind, code); await database.FinishJob(job, code);
        }
        finally
        {
            lease.Cancel();
            try { await heartbeat; } catch (OperationCanceledException) { } catch { logger.LogWarning("An operation lease could not be renewed."); }
        }
    }
}
