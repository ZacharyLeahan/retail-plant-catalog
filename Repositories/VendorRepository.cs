namespace Repositories;

using Dapper;
using Shared;
using System.Data;
using System.Threading.Tasks;

public class VendorRepository : Repository<Vendor>
{
    // Column list excluding PostGIS Geo column to avoid mapping issues
    // NOTE: We intentionally DO NOT select the persisted "PlantCount" column in list queries.
    // The persisted value can become stale; instead we compute it from vendor_plant for correctness.
    private const string VendorColumnsWithoutPlantCount =
        "\"Id\", \"UserId\", \"StoreName\", \"Lat\", \"Lng\", \"Approved\", \"Address\", \"AllNative\", \"State\", \"StoreUrl\", \"PublicEmail\", \"PublicPhone\", \"CreatedAt\", \"Notes\", \"LastCrawled\", \"LastChanged\", \"LastCrawlStatus\", \"CrawlErrors\", \"IsDeleted\", \"CrawlStartedAt\"";

    private const string VendorColumnsWithoutPlantCountAliased =
        "v.\"Id\", v.\"UserId\", v.\"StoreName\", v.\"Lat\", v.\"Lng\", v.\"Approved\", v.\"Address\", v.\"AllNative\", v.\"State\", v.\"StoreUrl\", v.\"PublicEmail\", v.\"PublicPhone\", v.\"CreatedAt\", v.\"Notes\", v.\"LastCrawled\", v.\"LastChanged\", v.\"LastCrawlStatus\", v.\"CrawlErrors\", v.\"IsDeleted\", v.\"CrawlStartedAt\"";

    private const string ComputedPlantCountSql =
        "(select count(*)::int from vendor_plant vp where vp.\"VendorId\" = v.\"Id\") as \"PlantCount\"";

    public VendorRepository(IDbConnection connection) : base(connection)
    {

    }

    // Override Get/GetAsync to avoid Dapper.Contrib's Get<T>, which selects the PostGIS "Geo" column.
    // Npgsql can fail to materialize geography without a type handler even if the model doesn't map it.
    // We explicitly select only the columns that map to Shared.Vendor.
    public override Vendor Get(string id)
    {
        if (string.IsNullOrEmpty(id)) return null!;
        var trimmedId = id.Trim();
        return conn.QueryFirstOrDefault<Vendor>(
            $"select {VendorColumnsWithoutPlantCountAliased}, {ComputedPlantCountSql} from vendor v where v.\"Id\" = @id",
            new { id = trimmedId }) ?? null!;
    }

    public override async Task<Vendor> GetAsync(string id)
    {
        if (string.IsNullOrEmpty(id)) return null!;
        var trimmedId = id.Trim();
        return await conn.QueryFirstOrDefaultAsync<Vendor>(
            $"select {VendorColumnsWithoutPlantCountAliased}, {ComputedPlantCountSql} from vendor v where v.\"Id\" = @id",
            new { id = trimmedId }) ?? null!;
    }
    public IEnumerable<Vendor> Find(bool unapprovedOnly, bool showDeleted, string state, string sortBy, int skip, int take)
    {
        var deleteConstraint = showDeleted ? "1=1" : "v.\"IsDeleted\" = false";
        string stateConstraint = " 1=1";
        if (state != "ALL")
            // Handle NULL states and trim whitespace - COALESCE converts NULL to empty string, TRIM removes whitespace
            stateConstraint = " TRIM(UPPER(COALESCE(v.\"State\", ''))) = UPPER(TRIM(@state)) ";
        
        // Validate and sanitize sortBy - if it's already formatted (contains quotes), use it as-is, otherwise quote it
        // Also provide a default if empty
        if (string.IsNullOrWhiteSpace(sortBy))
            sortBy = "\"StoreName\"";
        else if (!sortBy.Contains("\""))
            sortBy = $"\"{sortBy}\"";
        
        var selectList = $"{VendorColumnsWithoutPlantCountAliased}, {ComputedPlantCountSql}";

        var sql = unapprovedOnly
            ? $"select {selectList} from vendor v where v.\"Approved\" = false and {deleteConstraint} and {stateConstraint} order by {sortBy} limit @take offset @skip"
            : $"select {selectList} from vendor v where {stateConstraint} and {deleteConstraint} order by {sortBy} limit @take offset @skip";

        return conn.Query<Vendor>(sql, new { skip, take, state = state?.Trim() });
    }
    public override async Task<long> InsertAsync(Vendor obj)
    {
        // Ensure all DateTime values are UTC for PostgreSQL
        obj.CreatedAt = DateTime.UtcNow;
        var lastCrawled = obj.LastCrawled.HasValue 
            ? (obj.LastCrawled.Value.Kind == DateTimeKind.Utc ? obj.LastCrawled.Value : obj.LastCrawled.Value.ToUniversalTime())
            : (DateTime?)null;
        var lastChanged = obj.LastChanged.HasValue 
            ? (obj.LastChanged.Value.Kind == DateTimeKind.Utc ? obj.LastChanged.Value : obj.LastChanged.Value.ToUniversalTime())
            : (DateTime?)null;
        
        if (obj.Id == null)
            obj.Id = Guid.NewGuid().ToString();
        // PostGIS: Use ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        string point = $"ST_SetSRID(ST_MakePoint(@Lng, @Lat), 4326)::geography";
        var crawlStartedAt = obj.CrawlStartedAt.HasValue 
            ? (obj.CrawlStartedAt.Value.Kind == DateTimeKind.Utc ? obj.CrawlStartedAt.Value : obj.CrawlStartedAt.Value.ToUniversalTime())
            : (DateTime?)null;
        int recordsAffected =  await conn.ExecuteAsync(
            "insert into vendor (\"Id\", \"UserId\", \"StoreName\", \"Lat\", \"Lng\", \"Geo\", \"Approved\", \"Address\", \"AllNative\", \"State\", \"StoreUrl\", \"PublicEmail\", \"PublicPhone\", \"PlantCount\", \"CreatedAt\", \"Notes\", \"LastCrawled\", \"LastChanged\", \"LastCrawlStatus\", \"CrawlStartedAt\") " +
            "values (@Id, @UserId, @StoreName, @Lat, @Lng, " + point + ", @Approved, @Address, @AllNative, @State, @StoreUrl, @PublicEmail, @PublicPhone, @PlantCount, @CreatedAt, @Notes, @LastCrawled, @LastChanged, @LastCrawlStatus::crawl_status, @CrawlStartedAt)",
            new { 
                obj.Id, 
                obj.UserId, 
                obj.StoreName, 
                obj.Lat, 
                obj.Lng, 
                obj.Approved, 
                obj.Address, 
                obj.AllNative, 
                obj.State, 
                obj.StoreUrl, 
                obj.PublicEmail, 
                obj.PublicPhone, 
                obj.PlantCount, 
                CreatedAt = obj.CreatedAt, 
                obj.Notes, 
                LastCrawled = lastCrawled, 
                LastChanged = lastChanged, 
                LastCrawlStatus = obj.LastCrawlStatus.ToString(),
                CrawlStartedAt = crawlStartedAt
            });
        return recordsAffected;
    }
    public override long Insert(Vendor obj)
    {
        // Ensure all DateTime values are UTC for PostgreSQL
        obj.CreatedAt = DateTime.UtcNow;
        var lastCrawled = obj.LastCrawled.HasValue 
            ? (obj.LastCrawled.Value.Kind == DateTimeKind.Utc ? obj.LastCrawled.Value : obj.LastCrawled.Value.ToUniversalTime())
            : (DateTime?)null;
        var lastChanged = obj.LastChanged.HasValue 
            ? (obj.LastChanged.Value.Kind == DateTimeKind.Utc ? obj.LastChanged.Value : obj.LastChanged.Value.ToUniversalTime())
            : (DateTime?)null;
        
        if (obj.Id == null)
            obj.Id = Guid.NewGuid().ToString();
        // PostGIS: Use ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        string point = $"ST_SetSRID(ST_MakePoint(@Lng, @Lat), 4326)::geography";
        var crawlStartedAt = obj.CrawlStartedAt.HasValue 
            ? (obj.CrawlStartedAt.Value.Kind == DateTimeKind.Utc ? obj.CrawlStartedAt.Value : obj.CrawlStartedAt.Value.ToUniversalTime())
            : (DateTime?)null;
        var recordsAffected = conn.Execute(
            "insert into vendor (\"Id\", \"UserId\", \"StoreName\", \"Lat\", \"Lng\", \"Geo\", \"Approved\", \"Address\", \"AllNative\", \"State\", \"StoreUrl\", \"PublicEmail\", \"PublicPhone\", \"PlantCount\", \"CreatedAt\", \"Notes\", \"LastCrawled\", \"LastChanged\", \"LastCrawlStatus\", \"CrawlStartedAt\") " +
            "values (@Id, @UserId, @StoreName, @Lat, @Lng, " + point + ", @Approved, @Address, @AllNative, @State, @StoreUrl, @PublicEmail, @PublicPhone, @PlantCount, @CreatedAt, @Notes, @LastCrawled, @LastChanged, @LastCrawlStatus::crawl_status, @CrawlStartedAt)",
            new { 
                obj.Id, 
                obj.UserId, 
                obj.StoreName, 
                obj.Lat, 
                obj.Lng, 
                obj.Approved, 
                obj.Address, 
                obj.AllNative, 
                obj.State, 
                obj.StoreUrl, 
                obj.PublicEmail, 
                obj.PublicPhone, 
                obj.PlantCount, 
                CreatedAt = obj.CreatedAt, 
                obj.Notes, 
                LastCrawled = lastCrawled, 
                LastChanged = lastChanged, 
                LastCrawlStatus = obj.LastCrawlStatus.ToString(),
                CrawlStartedAt = crawlStartedAt
            });
        return recordsAffected;
    }
    public override bool Update(Vendor obj)
    {
        // Ensure DateTime values are UTC for PostgreSQL
        var lastCrawled = obj.LastCrawled.HasValue 
            ? (obj.LastCrawled.Value.Kind == DateTimeKind.Utc ? obj.LastCrawled.Value : obj.LastCrawled.Value.ToUniversalTime())
            : (DateTime?)null;
        var lastChanged = obj.LastChanged.HasValue 
            ? (obj.LastChanged.Value.Kind == DateTimeKind.Utc ? obj.LastChanged.Value : obj.LastChanged.Value.ToUniversalTime())
            : (DateTime?)null;
        var crawlStartedAt = obj.CrawlStartedAt.HasValue 
            ? (obj.CrawlStartedAt.Value.Kind == DateTimeKind.Utc ? obj.CrawlStartedAt.Value : obj.CrawlStartedAt.Value.ToUniversalTime())
            : (DateTime?)null;
        
        // PostGIS: Use ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        string point = $"ST_SetSRID(ST_MakePoint(@Lng, @Lat), 4326)::geography";
        var rowsAffected = conn.Execute(
            $"update vendor set \"StoreName\"=@StoreName, \"Address\"=@Address, \"Lng\"=@Lng, \"Lat\"=@Lat, \"Geo\"={point}, \"StoreUrl\"=@StoreUrl, \"PublicEmail\"=@PublicEmail, \"PublicPhone\"=@PublicPhone, \"Approved\"=@Approved, \"PlantCount\"=@PlantCount, \"AllNative\"=@AllNative, \"CrawlErrors\"=@CrawlErrors, \"Notes\"=@Notes, \"LastCrawlStatus\"=@LastCrawlStatus::crawl_status, \"LastCrawled\"=@LastCrawled, \"LastChanged\"=@LastChanged, \"CrawlStartedAt\"=@CrawlStartedAt where \"Id\" = @Id",
            new {
                obj.Id,
                obj.StoreName,
                obj.Address,
                obj.Lng,
                obj.Lat,
                obj.StoreUrl,
                obj.PublicEmail,
                obj.PublicPhone,
                obj.Approved,
                obj.PlantCount,
                obj.AllNative,
                obj.CrawlErrors,
                obj.Notes,
                LastCrawlStatus = obj.LastCrawlStatus.ToString(),
                LastCrawled = lastCrawled,
                LastChanged = lastChanged,
                CrawlStartedAt = crawlStartedAt
            });
        return rowsAffected > 0;
    }
    
    public IEnumerable<Vendor> Find(string? storeName, string state, bool unapprovedOnly, bool showDeleted, string sortBy, bool sortAsc, int skip, int take)
    {
        var deleteConstraint = showDeleted ? "1=1" : "v.\"IsDeleted\" = false";
        
        // Validate and format sortBy
        if (string.IsNullOrWhiteSpace(sortBy))
            sortBy = "StoreName";
        
        // Format sortBy with quotes and direction
        string formattedSortBy = $"\"{sortBy}\"" + (sortAsc ? "" : " desc");
        
        if (string.IsNullOrEmpty(storeName)) return Find(unapprovedOnly, showDeleted, state, formattedSortBy, skip, take);
        
        string stateConstraint = "";
        if (state != "ALL")
            // Handle NULL states and trim whitespace - COALESCE converts NULL to empty string, TRIM removes whitespace
            stateConstraint = " and TRIM(UPPER(COALESCE(v.\"State\", ''))) = UPPER(TRIM(@state)) ";
        storeName = $"%{storeName}%";
        var selectList = $"{VendorColumnsWithoutPlantCountAliased}, {ComputedPlantCountSql}";

        var sql = unapprovedOnly
            ? $"select {selectList} from vendor v where v.\"StoreName\" like @storeName {stateConstraint} and v.\"Approved\" = false and {deleteConstraint} order by {formattedSortBy} limit @take offset @skip"
            : $"select {selectList} from vendor v where v.\"StoreName\" like @storeName and {deleteConstraint} {stateConstraint} order by {formattedSortBy} limit @take offset @skip";

        return conn.Query<Vendor>(sql, new { storeName, skip, take, state = state?.Trim() });
    }

    public void Approve(string id, bool approved)
    {
        var rowsAffected = conn.Execute("update vendor set \"Approved\" = @approved where \"Id\" = @id", new { id, approved });

    }

     public int Delete(string id, bool deleteStatus = true)
    {
        var rowsAffected = conn.Execute("update vendor set \"IsDeleted\" = @deleteStatus where \"Id\" = @id", new { id, deleteStatus });
        return rowsAffected;
    }

    private void ClearAndInsertUrls(string? vendorId, string[] urls)
    {
        if (vendorId == null) return;
        var rowsAffected = conn.Execute("delete from vendor_urls where \"VendorId\" = @vendorId", new { vendorId });
        if (urls.Any())
        {
            foreach (var url in urls)
            {
                conn.Execute("insert into vendor_urls (\"Id\", \"VendorId\", \"Uri\") values (@id, @vendorId, @uri)", new { id = Guid.NewGuid().ToString(), vendorId, uri = url });
            }
        }
    }

    public Vendor? FindByUserId(string userId)
    {
        var vendor = conn.QueryFirstOrDefault<Vendor>(
            $"select {VendorColumnsWithoutPlantCountAliased}, {ComputedPlantCountSql} from vendor v where v.\"UserId\" = @userId and v.\"IsDeleted\" = false",
            new { userId });
        if (vendor == null) return null;
        return vendor;
    }

    public IEnumerable<VendorPlus> FindByRadius(double lng, double lat, int radius = 10000){ // 10km
        // PostGIS: Use ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography and ST_DistanceSphere
        var point = $"ST_SetSRID(ST_MakePoint(@lng, @lat), 4326)::geography";
        /*
        PostGIS equivalent:
        SELECT ST_DistanceSphere(ST_SetSRID(ST_MakePoint(-86.8025, 33.5207), 4326)::geography, Geo) / 1000 distance, lat, lng, address, storename
        FROM vendor
        WHERE ST_DistanceSphere(ST_SetSRID(ST_MakePoint(-86.8025, 33.5207), 4326)::geography, Geo) <= 50000
        order by distance;
        */
        return conn.Query<VendorPlus>($"SELECT ST_DistanceSphere({point}, \"Geo\") / 1000 distance, v.* FROM vendor v WHERE v.\"Approved\" and not v.\"IsDeleted\" and ST_DistanceSphere({point}, \"Geo\") <= @radius order by distance;", new { radius, lat, lng });
    }

    public ZipCode? NearestZip(double lng, double lat)
    {
        // PostGIS: Use ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography and ST_DistanceSphere
        var point = $"ST_SetSRID(ST_MakePoint(@lng, @lat), 4326)::geography";
        /*
        PostGIS equivalent:
        SELECT "Code", "City", "State", ST_DistanceSphere(ST_SetSRID(ST_MakePoint(-86.7461, 33.42872), 4326)::geography, Geo) / 1000 distance FROM zip 
        WHERE ST_DistanceSphere(ST_SetSRID(ST_MakePoint(-86.7461, 33.42872), 4326)::geography, Geo) / 1000 <= 10
        order by distance 
        */
        var sql = $"SELECT \"Code\", \"City\", \"State\", ST_DistanceSphere({point}, \"Geo\") / 1000 distance FROM zip WHERE ST_DistanceSphere({point}, \"Geo\") / 1000 <= 10 order by distance;";
        return conn.QueryFirstOrDefault<ZipCode>(sql, new { lng, lat });

    }

    public IEnumerable<Vendor> FindByState(string state)
    {
        if (state == "ALL")
            return conn.Query<Vendor>($"select {VendorColumnsWithoutPlantCountAliased}, {ComputedPlantCountSql} from vendor v where \"Approved\" and not \"IsDeleted\" order by v.\"StoreName\"", new { state });
        // Handle NULL states and trim whitespace - COALESCE converts NULL to empty string, TRIM removes whitespace
        return conn.Query<Vendor>($"select {VendorColumnsWithoutPlantCountAliased}, {ComputedPlantCountSql} from vendor v where \"Approved\" and not \"IsDeleted\" and TRIM(UPPER(COALESCE(v.\"State\", ''))) = UPPER(TRIM(@state)) order by v.\"StoreName\"", new { state = state?.Trim() });
    }

    public IEnumerable<Vendor> FindByPlant(string plantName)
    {
        var term = $"%{plantName}%";
        // Use computed plant count for correctness
        var selectList = $"{VendorColumnsWithoutPlantCountAliased}, {ComputedPlantCountSql}";
        return conn.Query<Vendor>(
            $"select {selectList} from vendor v inner join vendor_plant vp on vp.\"VendorId\" = v.\"Id\" inner join plant p on p.\"Id\" = vp.\"PlantId\" where v.\"Approved\" and not v.\"IsDeleted\" and (p.\"ScientificName\" like @term or p.\"CommonName\" like @term)",
            new { term });
    }
}