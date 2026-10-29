namespace Thesamenot.Api.Validation;

public static class AccountValidation
{
    public static void Profile(ProfileUpdate value)
    {
        Text(value.DisplayName, 120);
        if (value.Version < 0) throw new StoreException(400, "Invalid profile version.");
    }
    public static void Address(AddressUpdate value)
    {
        Text(value.Label, 60); Text(value.Name, 120); Text(value.Address, 250);
        Text(value.City, 120); Text(value.PostalCode, 24);
        if (value.Country != "GR" || value.Phone is null || value.Phone.Length > 32 ||
            value.Phone.Any(c => !char.IsDigit(c) && !"+- ()".Contains(c)) || value.Version < 0)
            throw new StoreException(400, "Check the address, country and telephone.");
    }
    public static (int Page, int Size) Pagination(int? page, int? pageSize)
    {
        var number = page ?? 1; var size = pageSize ?? 24;
        if (number is < 1 or > 10000 || size is < 1 or > 100)
            throw new StoreException(400, "Invalid page or page size.");
        return (number, size);
    }
    public static void Text(string? value, int length)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Trim().Length > length)
            throw new StoreException(400, "Check the required fields and their lengths.");
    }
}
