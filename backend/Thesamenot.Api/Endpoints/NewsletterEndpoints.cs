using Thesamenot.Api.Validation;

namespace Thesamenot.Api.Endpoints;

public static class NewsletterEndpoints
{
    public static IEndpointRouteBuilder MapNewsletterEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var newsletter = endpoints.MapGroup("/api/newsletter").RequireRateLimiting("public");
        newsletter.MapPost("", SubscribeAsync);
        newsletter.MapPost("/unsubscribe", UnsubscribeAsync);
        return endpoints;
    }

    private static async Task<IResult> SubscribeAsync(NewsletterRequest request, StoreDatabase database)
    {
        RequestValidation.ValidateNewsletter(request);
        await database.Subscribe(request);
        return Results.Ok(new { message = "You are on the list." });
    }

    private static async Task<IResult> UnsubscribeAsync(UnsubscribeRequest request, StoreDatabase database)
    {
        await database.Unsubscribe(request.Token);
        return Results.Ok(new { message = "You have been unsubscribed." });
    }
}
