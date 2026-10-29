namespace Thesamenot.Api;

public sealed class StoreJob
{
    public string Id { get; set; } = "";
    public string Kind { get; set; } = "";
    public string ProtectedPayload { get; set; } = "";
    public string State { get; set; } = "";
    public int Attempts { get; set; }
    public string? LeaseId { get; set; }
}
public record EmailJob(string Email, string Purpose, string? Token = null, string? Text = null);
public record ProviderEventJob(string Json);
public record RefundJob(string RefundId);
public record ReconcileOrderJob(string OrderId);
public record RefundRequest(string RequestKey, int AmountCents, string Reason, string ChallengeToken, string Code);
public sealed class StoreRefund
{
    public string Id { get; set; } = "";
    public string OrderId { get; set; } = "";
    public string RequestKey { get; set; } = "";
    public int AmountCents { get; set; }
    public string Reason { get; set; } = "";
    public string State { get; set; } = "";
    public string? ProviderId { get; set; }
    public DateTime CreatedUtc { get; set; }
}
public record ShipmentRequest(string Courier, string TrackingNumber, string TrackingUrl, int Version);
public record ReturnLine(long OrderItemId, int Quantity);
public record ReturnRequest(string OrderId, string RequestKey, string Kind, string Reason, List<ReturnLine> Items);
public record ReturnUpdate(string State, int Version, string Reason = "");
public record RestockLine(long OrderItemId, int ReceivedQuantity, int RestockQuantity);
public record ReturnInspection(int Version, List<RestockLine> Items, string Reason);
