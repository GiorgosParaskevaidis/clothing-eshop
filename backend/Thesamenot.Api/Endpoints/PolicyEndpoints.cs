namespace Thesamenot.Api.Endpoints;

public static class PolicyEndpoints
{
    public static IEndpointRouteBuilder MapPolicyEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/policies/{slug}", (string slug, IConfiguration configuration) => Services.LegalPolicies.Read(configuration, slug)).RequireRateLimiting("catalog");
        return endpoints;
    }
}
