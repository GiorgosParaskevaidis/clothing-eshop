using Thesamenot.Api.Validation;

namespace Thesamenot.Api.Endpoints;

public static class NewsletterEndpoints
{
    public static IEndpointRouteBuilder MapNewsletterEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var newsletter = endpoints.MapGroup("/api/newsletter").RequireRateLimiting("public");
        newsletter.MapPost("", SubscribeAsync);
        newsletter.MapPost("/unsubscribe", UnsubscribeAsync);
        newsletter.MapPost("/confirm", async (UnsubscribeRequest request, StoreDatabase database) => { await database.ConfirmNewsletter(request.Token); return Results.Ok(new { message = "Your subscription is confirmed." }); });
        return endpoints;
    }

    private static async Task<IResult> SubscribeAsync(NewsletterRequest request, StoreDatabase database)
    {
        RequestValidation.ValidateNewsletter(request);
        await database.RequestNewsletter(request);
        return Results.Ok(new { message = "Check your email to confirm your subscription." });
    }

    private static async Task<IResult> UnsubscribeAsync(UnsubscribeRequest request, StoreDatabase database)
    {
        await database.LeaveNewsletter(request.Token);
        return Results.Ok(new { message = "You have been unsubscribed." });
    }
}
