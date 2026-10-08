using Stripe;
using Stripe.Checkout;

namespace Thesamenot.Api;

public sealed class Payments(StoreDatabase database,IConfiguration configuration,StoreOptions options,IWebHostEnvironment environment) {
    public bool IsSimulation => environment.IsDevelopment() && options.PaymentMode=="Simulation";
    public bool Ready => IsSimulation || (options.PaymentMode=="Stripe" && !string.IsNullOrWhiteSpace(configuration["Stripe:SecretKey"]) && !string.IsNullOrWhiteSpace(configuration["Stripe:WebhookSecret"]));
    private SessionService Sessions() => new(new StripeClient(configuration["Stripe:SecretKey"]));
    public async Task<object> Checkout(CheckoutRequest request) {
        if(!options.SalesEnabled || (!IsSimulation && DateTimeOffset.UtcNow<options.DropOpensAt)) throw new StoreException(409,"The drop is not open yet.");
        if(!Ready) throw new StoreException(503,"Checkout is temporarily unavailable. Please try again later.");
        var order=await database.Find(request.RequestKey);
        if(order is null) {
            try {order=await database.Reserve(request,options);}
            catch(MySqlConnector.MySqlException e) when(e.Number==1062) {order=await database.Find(request.RequestKey); if(order is null) throw;}
        }
        if(order.PayloadHash!=StoreDatabase.Hash(request)) throw new StoreException(409,"This checkout attempt changed. Start a new checkout.");
        if(order.Status!="pending") throw new StoreException(409,"This checkout has already finished. Start a new checkout.");
        if(order.PaymentMode!=options.PaymentMode) throw new StoreException(409,"Payment settings changed. Please contact the store.");
        if(order.CheckoutUrl is null) {
            if(IsSimulation) await database.AttachSession(order,null,$"{options.PublicUrl}/checkout/simulation?token={order.PublicToken}");
            else {
                // Retry uncertain network outcomes with the same Stripe idempotency key; keep stock reserved.
                var session=await Sessions().CreateAsync(new SessionCreateOptions {
                    Mode="payment", AllowedPaymentMethodTypes=["card"], CustomerEmail=order.Email,
                    ClientReferenceId=order.Id, Metadata=new(){{"order_id",order.Id}},
                    SuccessUrl=$"{options.PublicUrl}/checkout/success?token={order.PublicToken}",
                    CancelUrl=$"{options.PublicUrl}/checkout?cancelled=1",
                    ExpiresAt=DateTime.SpecifyKind(order.CreatedUtc,DateTimeKind.Utc).AddMinutes(31),
                    LineItems=order.Items.Select(i=>new SessionLineItemOptions {
                        Quantity=i.Quantity, PriceData=new SessionLineItemPriceDataOptions {
                            Currency="eur",UnitAmount=i.UnitPriceCents,
                            ProductData=new SessionLineItemPriceDataProductDataOptions { Name=$"{i.ProductName} / {i.Size}" }
                        }
                    }).ToList(),
                    ShippingOptions=[new SessionShippingOptionOptions {
                        ShippingRateData=new SessionShippingOptionShippingRateDataOptions {
                            Type="fixed_amount", DisplayName="Delivery in Greece",
                            FixedAmount=new SessionShippingOptionShippingRateDataFixedAmountOptions {Amount=order.ShippingCents,Currency="eur"}
                        }
                    }]
                },new RequestOptions {IdempotencyKey=order.Id});
                await database.AttachSession(order,session.Id,session.Url);
            }
        }
        return new {order.PublicToken,order.CheckoutUrl,order.TotalCents};
    }
    public async Task Webhook(string json,string signature) {
        if(string.IsNullOrWhiteSpace(configuration["Stripe:WebhookSecret"])) throw new StoreException(503,"Payments are not configured.");
        var evt=EventUtility.ConstructEvent(json,signature,configuration["Stripe:WebhookSecret"],throwOnApiVersionMismatch:false);
        if(evt.Data.Object is not Session session || evt.Type is not ("checkout.session.completed" or "checkout.session.expired")) return;
        if(!session.Metadata.TryGetValue("order_id",out var id)) throw new StoreException(400,"Missing order reference.");
        if(evt.Type=="checkout.session.completed" && session.PaymentStatus=="paid") {
            if(session.Currency!="eur") throw new StoreException(400,"Unexpected payment currency.");
            await database.Transition(id,"paid",evt.Id,session.Id,checked((int)(session.AmountTotal??-1)));
        } else if(evt.Type=="checkout.session.expired") await database.Transition(id,"expired",evt.Id,session.Id);
    }
    public async Task CompleteSimulation(string token) {
        if(!IsSimulation) throw new StoreException(404,"Not found.");
        var order=await database.PublicOrder(token)??throw new StoreException(404,"Order not found.");
        if(order.PaymentMode!="Simulation") throw new StoreException(400,"Not a simulation order.");
        if(order.ExpiresUtc<DateTime.UtcNow) { await database.Transition(order.Id,"expired"); throw new StoreException(409,"This checkout expired."); }
        await database.Transition(order.Id,"paid");
    }
    public async Task Reconcile() {
        foreach(var order in await database.Expiring()) {
            if(order.PaymentMode=="Simulation") {await database.Transition(order.Id,"expired");continue;}
            if(!Ready) continue;
            if(order.StripeSessionId is null) {
                // Find a possibly-created session before releasing reservations from a timed-out request.
                var filter=new SessionListOptions {Created=new DateRangeOptions {GreaterThanOrEqual=DateTime.SpecifyKind(order.CreatedUtc,DateTimeKind.Utc).AddMinutes(-1),LessThanOrEqual=DateTime.SpecifyKind(order.ExpiresUtc,DateTimeKind.Utc)},Limit=100};
                var sessions=await Sessions().ListAsync(filter);
                Session? found=null;
                while(true) {
                    found=sessions.Data.FirstOrDefault(s=>s.ClientReferenceId==order.Id);
                    if(found is not null || !sessions.HasMore) break;
                    filter.StartingAfter=sessions.Data.Last().Id;sessions=await Sessions().ListAsync(filter);
                }
                if(found is null) {await database.Transition(order.Id,"expired");continue;}
                await database.AttachSession(order,found.Id,found.Url??"");
            }
            var session=await Sessions().GetAsync(order.StripeSessionId);
            if(session.PaymentStatus=="paid" && session.Currency=="eur") await database.Transition(order.Id,"paid",stripeSessionId:session.Id,paidAmount:checked((int)(session.AmountTotal??-1)));
            else if(session.Status=="expired") await database.Transition(order.Id,"expired",stripeSessionId:session.Id);
        }
    }
}
public sealed class ReservationWorker(Payments payments,ILogger<ReservationWorker> logger) : BackgroundService {
    protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
        using var timer=new PeriodicTimer(TimeSpan.FromMinutes(1));
        while(await timer.WaitForNextTickAsync(stoppingToken)) {
            try {await payments.Reconcile();} catch(Exception e) {logger.LogWarning(e,"Reservation reconciliation will retry.");}
        }
    }
}
