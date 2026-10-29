using Thesamenot.Api.Validation;

namespace Thesamenot.Api;

public sealed partial class Payments
{
    // The public checkout only creates offline orders. Provider code is retained for historical orders.
    public async Task<object> ManualCheckout(CheckoutRequest request, CheckoutOwner owner)
    {
        RequestValidation.ValidateCheckout(request);
        // Preserve the existing local/demo schedule bypass without offering simulated payment checkout.
        if (!options.SalesEnabled || (!IsSimulation && DateTimeOffset.UtcNow < options.DropOpensAt))
            throw new StoreException(409, "The drop is not open yet.");
        if (owner.UserId is not null) request = request with { Email = owner.Email! };
        request = request with { Email = request.Email.Trim().ToLowerInvariant(), Name = request.Name.Trim(), Address = request.Address.Trim(), City = request.City.Trim(), PostalCode = request.PostalCode.Trim(), Phone = request.Phone.Trim() };
        var order = await database.Find(request.RequestKey, owner);
        if (order is null)
        {
            try { order = await database.Reserve(request, options, owner, manual: true); }
            catch (MySqlConnector.MySqlException error) when (error.Number == 1062)
            { order = await database.Find(request.RequestKey, owner); if (order is null) throw; }
        }
        if (order.PayloadHash != StoreDatabase.Hash(request)) throw new StoreException(409, "This checkout attempt changed. Start a new checkout.");
        if (!ManualPaymentMethods.IsManual(order.PaymentMode) || order.Status is "cancelled" or "expired")
            throw new StoreException(409, "This checkout has already finished. Start a new checkout.");
        return new { order.PublicToken, checkoutUrl = $"{options.PublicUrl}/checkout/success?token={order.PublicToken}", order.TotalCents };
    }
}
