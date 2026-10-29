namespace Thesamenot.Api.Services;

public abstract class StoreQueueWorker(StoreDatabase database, StoreJobRunner runner, ILogger<StoreQueueWorker> logger, string kind, int batch) : BackgroundService
{
    protected StoreDatabase Database => database;
    protected abstract Task Process(StoreJob job);
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(2));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try { for (var i = 0; i < batch; i++) { var job = await database.LeaseJob(kind); if (job is null) break; await runner.Run(job, () => Process(job), stoppingToken); } }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { logger.LogWarning("Queue {Kind} will retry ({Code}).", kind, error is MySqlConnector.MySqlException sql ? "database_" + sql.Number : error.GetType().Name); }
        }
    }
}
public sealed class OperationsWorker(StoreDatabase database, Payments payments, StoreJobRunner runner, ILogger<StoreQueueWorker> logger)
    : StoreQueueWorker(database, runner, logger, "stripe-event", 20)
{
    protected override Task Process(StoreJob job) => payments.ProcessProviderEvent(Database.JobPayload<ProviderEventJob>(job).Json);
}
public sealed class RefundWorker(StoreDatabase database, Payments payments, StoreJobRunner runner, ILogger<StoreQueueWorker> logger)
    : StoreQueueWorker(database, runner, logger, "refund", 10)
{
    protected override Task Process(StoreJob job) => payments.ProcessRefund(Database.JobPayload<RefundJob>(job).RefundId);
}
public sealed class ReconciliationWorker(StoreDatabase database, Payments payments, StoreJobRunner runner, ILogger<StoreQueueWorker> logger)
    : StoreQueueWorker(database, runner, logger, "reconcile-order", 10)
{
    protected override Task Process(StoreJob job) => payments.ReconcileOrder(Database.JobPayload<ReconcileOrderJob>(job).OrderId);
}
