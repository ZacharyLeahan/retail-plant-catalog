namespace Repositories;

using Dapper;
using Shared;
using System.Data;

public class VendorUrlRepository : Repository<VendorUrl>
{
    public VendorUrlRepository(IDbConnection connection): base(connection)
    {

    }

    public VendorUrl GetByUrlOrId(VendorUrl url)
    {
        return conn.QueryFirstOrDefault<VendorUrl>("select * from vendor_urls where \"Id\" = @id or (\"Uri\" = @Uri AND \"VendorId\" = @VendorId)", url);
    }

    public IEnumerable<VendorUrl> FindForVendor(string vendorId)
    {
        return conn.Query<VendorUrl>("select * from vendor_urls where \"VendorId\" = @vendorId", new { vendorId });
    }
    public async Task<IEnumerable<VendorUrl>> FindForVendorAsync(string vendorId)
    {
        return await conn.QueryAsync<VendorUrl>("select * from vendor_urls where \"VendorId\" = @vendorId", new { vendorId });
    }

    public override long Insert(VendorUrl obj)
    {
        // Ensure DateTime values are UTC for PostgreSQL
        var lastSucceeded = obj.LastSucceeded.HasValue
            ? (obj.LastSucceeded.Value.Kind == DateTimeKind.Utc ? obj.LastSucceeded.Value : obj.LastSucceeded.Value.ToUniversalTime())
            : (DateTime?)null;
        var lastFailed = obj.LastFailed.HasValue
            ? (obj.LastFailed.Value.Kind == DateTimeKind.Utc ? obj.LastFailed.Value : obj.LastFailed.Value.ToUniversalTime())
            : (DateTime?)null;

        var parameters = new DynamicParameters();
        parameters.Add("@Id", obj.Id);
        parameters.Add("@Uri", obj.Uri);
        parameters.Add("@VendorId", obj.VendorId);
        parameters.Add("@LastSucceeded", lastSucceeded);
        parameters.Add("@LastFailed", lastFailed);
        parameters.Add("@LastStatus", obj.LastStatus.ToString(), DbType.String);
        
        return conn.Execute(
            "insert into vendor_urls (\"Id\", \"Uri\", \"VendorId\", \"LastSucceeded\", \"LastFailed\", \"LastStatus\") values (@Id, @Uri, @VendorId, @LastSucceeded, @LastFailed, @LastStatus::crawl_status)", 
            parameters);
    }

    public async override Task<long> InsertAsync(VendorUrl obj)
    {
        // Ensure DateTime values are UTC for PostgreSQL
        var lastSucceeded = obj.LastSucceeded.HasValue
            ? (obj.LastSucceeded.Value.Kind == DateTimeKind.Utc ? obj.LastSucceeded.Value : obj.LastSucceeded.Value.ToUniversalTime())
            : (DateTime?)null;
        var lastFailed = obj.LastFailed.HasValue
            ? (obj.LastFailed.Value.Kind == DateTimeKind.Utc ? obj.LastFailed.Value : obj.LastFailed.Value.ToUniversalTime())
            : (DateTime?)null;

        var parameters = new DynamicParameters();
        parameters.Add("@Id", obj.Id);
        parameters.Add("@Uri", obj.Uri);
        parameters.Add("@VendorId", obj.VendorId);
        parameters.Add("@LastSucceeded", lastSucceeded);
        parameters.Add("@LastFailed", lastFailed);
        parameters.Add("@LastStatus", obj.LastStatus.ToString(), DbType.String);
        
        return await conn.ExecuteAsync(
            "insert into vendor_urls (\"Id\", \"Uri\", \"VendorId\", \"LastSucceeded\", \"LastFailed\", \"LastStatus\") values (@Id, @Uri, @VendorId, @LastSucceeded, @LastFailed, @LastStatus::crawl_status)", 
            parameters);
    }
    public override bool Update(VendorUrl obj)
    {
        // Ensure DateTime values are UTC for PostgreSQL
        var lastSucceeded = obj.LastSucceeded.HasValue
            ? (obj.LastSucceeded.Value.Kind == DateTimeKind.Utc ? obj.LastSucceeded.Value : obj.LastSucceeded.Value.ToUniversalTime())
            : (DateTime?)null;
        var lastFailed = obj.LastFailed.HasValue
            ? (obj.LastFailed.Value.Kind == DateTimeKind.Utc ? obj.LastFailed.Value : obj.LastFailed.Value.ToUniversalTime())
            : (DateTime?)null;

        var parameters = new DynamicParameters();
        parameters.Add("@Id", obj.Id);
        parameters.Add("@Uri", obj.Uri);
        parameters.Add("@LastSucceeded", lastSucceeded);
        parameters.Add("@LastFailed", lastFailed);
        parameters.Add("@LastStatus", obj.LastStatus.ToString(), DbType.String);

        var rowsAffected = conn.Execute(
            "update vendor_urls set \"Uri\"=@Uri, \"LastSucceeded\"=@LastSucceeded, \"LastFailed\"=@LastFailed, \"LastStatus\"=@LastStatus::crawl_status where \"Id\" =@Id",
            parameters);
        return rowsAffected > 0;
    }
    public async override Task<bool> UpdateAsync(VendorUrl obj)
    {
        // Ensure DateTime values are UTC for PostgreSQL
        var lastSucceeded = obj.LastSucceeded.HasValue
            ? (obj.LastSucceeded.Value.Kind == DateTimeKind.Utc ? obj.LastSucceeded.Value : obj.LastSucceeded.Value.ToUniversalTime())
            : (DateTime?)null;
        var lastFailed = obj.LastFailed.HasValue
            ? (obj.LastFailed.Value.Kind == DateTimeKind.Utc ? obj.LastFailed.Value : obj.LastFailed.Value.ToUniversalTime())
            : (DateTime?)null;

        var parameters = new DynamicParameters();
        parameters.Add("@Id", obj.Id);
        parameters.Add("@Uri", obj.Uri);
        parameters.Add("@LastSucceeded", lastSucceeded);
        parameters.Add("@LastFailed", lastFailed);
        parameters.Add("@LastStatus", obj.LastStatus.ToString(), DbType.String);

        var rowsAffected = await conn.ExecuteAsync(
            "update vendor_urls set \"Uri\"=@Uri, \"LastSucceeded\"=@LastSucceeded, \"LastFailed\"=@LastFailed, \"LastStatus\"=@LastStatus::crawl_status where \"Id\" =@Id",
            parameters);
        return rowsAffected > 0;
    }
}

