using System.Globalization;
using System.Net.Mail;
using Dapper;
using MySqlConnector;

namespace Thesamenot.Api;

public sealed partial class StoreDatabase
{
    private async Task<string> OrderNotificationEmail(MySqlConnection db, MySqlTransaction tx)
    {
        // Identity is authoritative: a verified admin email change must affect new orders.
        var email = configuration.GetValue("Auth:Enabled", false)
            ? await db.QuerySingleOrDefaultAsync<string>("""
                SELECT u.email FROM users u JOIN user_roles r ON r.user_id=u.id
                WHERE r.role_id='admin' AND u.enabled AND u.email_confirmed
                ORDER BY u.created_utc,u.id LIMIT 1 LOCK IN SHARE MODE
                """, transaction: tx)
            : configuration["Admin:Email"];
        if (string.IsNullOrWhiteSpace(email) || !MailAddress.TryCreate(email, out var address) || address.Address != email)
            throw new StoreException(503, "Order notifications are currently unavailable. Please contact the store.");
        return email;
    }

    private async Task EnqueueOrderEmails(MySqlConnection db, MySqlTransaction tx, Order order, string adminEmail)
    {
        // Both jobs commit with the order. Checkout retries reuse it and cannot enqueue a second pair.
        var lines = string.Join("\n", order.Items.Select(item =>
            $"{item.Quantity} × {item.ProductName} ({item.Size}) — {OrderEmailAmount(item.UnitPriceCents * item.Quantity, order.Currency)}"));
        var totals = $"\nSubtotal: {OrderEmailAmount(order.SubtotalCents, order.Currency)}" +
            $"\nShipping: {OrderEmailAmount(order.ShippingCents, order.Currency)}\nTotal: {OrderEmailAmount(order.TotalCents, order.Currency)}";
        await EnqueueJob(db, tx, "email:order:" + order.Id + ":created", "email", new EmailJob(order.Email, "order-created",
            Text: "Your order " + order.OrderNumber + " has been received.\n\n" + lines + totals + "\n\n" + ManualPaymentMethods.SnapshotInstructions(order)));
        var method = order.PaymentMode == ManualPaymentMethods.BankTransfer ? "Τραπεζική κατάθεση σε Revolut" : "Αντικαταβολή";
        var pending = order.PaymentMode == ManualPaymentMethods.BankTransfer
            ? "Αναμένεται κατάθεση. Επιβεβαιώστε την πραγματική είσπραξη πριν την αποστολή."
            : "Ανεξόφλητη αντικαταβολή. Η είσπραξη επιβεβαιώνεται μετά την αποστολή και την απόδοση από τον courier.";
        await EnqueueJob(db, tx, "email:order:" + order.Id + ":admin-created", "email", new EmailJob(adminEmail, "order-created-admin",
            Text: $"Νέα παραγγελία {order.OrderNumber}\nΠληρωμή: {method}\n{pending}\n\n" + lines +
                $"\nΥποσύνολο: {OrderEmailAmount(order.SubtotalCents, order.Currency)}\nΜεταφορικά: {OrderEmailAmount(order.ShippingCents, order.Currency)}" +
                $"\nΣύνολο: {OrderEmailAmount(order.TotalCents, order.Currency)}\n\nΠελάτης: {order.Name}\nEmail: {order.Email}\nΤηλέφωνο: {order.Phone}" +
                $"\nΔιεύθυνση: {order.Address}, {order.PostalCode} {order.City}, {order.Country}\n\n" +
                configuration["Store:PublicUrl"]!.TrimEnd('/') + "/admin/orders"));
    }

    private static string OrderEmailAmount(int cents, string currency) =>
        (cents / 100m).ToString("0.00", CultureInfo.InvariantCulture) + " " + currency;
}
