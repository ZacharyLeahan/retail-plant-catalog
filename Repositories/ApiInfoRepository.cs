namespace Repositories;

using Dapper;
using Shared;
using System.Data;

public class ApiInfoRepository : Repository<ApiInfo>
{
    public ApiInfoRepository(IDbConnection connection) : base(connection)
    {
    }

    public ApiInfo? FindByUserId(string userId)
    {
        return conn.QueryFirstOrDefault<ApiInfo>("select * from api_info where \"UserId\" = @userId", new { userId });
    }

    // Override Insert to use explicit SQL with quoted identifiers for PostgreSQL
    public override long Insert(ApiInfo obj)
    {
        var id = conn.QuerySingle<int>(
            "insert into api_info (\"Name\", \"UserId\", \"OrganizationName\", \"Phone\", \"Address\", \"IntendedUse\", \"CreatedAt\", \"Lng\", \"Lat\") " +
            "values (@Name, @UserId, @OrganizationName, @Phone, @Address, @IntendedUse, @CreatedAt, @Lng, @Lat) RETURNING \"Id\"",
            obj);
        obj.Id = id;
        return id;
    }

    // Override Update to use explicit SQL with quoted identifiers for PostgreSQL
    public override bool Update(ApiInfo obj)
    {
        var rowsAffected = conn.Execute(
            "update api_info set \"Name\"=@Name, \"OrganizationName\"=@OrganizationName, \"Phone\"=@Phone, \"Address\"=@Address, \"IntendedUse\"=@IntendedUse, \"Lng\"=@Lng, \"Lat\"=@Lat where \"Id\" = @Id",
            obj);
        return rowsAffected > 0;
    }
}