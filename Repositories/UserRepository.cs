namespace Repositories;

using Dapper;
using Dapper.Contrib.Extensions;
using Shared;
using System.Data;

public class UserRepository : Repository<User>
{
    public UserRepository(IDbConnection connection) :base(connection)
    {
    }

    public IEnumerable<User> Find(bool showAdminOnly, int skip, int take)
    {
        IEnumerable<User> users;
        if (showAdminOnly)
            users = conn.Query<User>("select u.*, api.\"IntendedUse\" from \"user\" u left join api_info api on api.\"UserId\" = u.\"Id\" where u.\"Role\" = 'Admin' order by u.\"Email\" limit @take offset @skip", new { skip, take });
        else
            users = conn.Query<User>("select u.*, api.\"IntendedUse\" from \"user\" u left join api_info api on api.\"UserId\" = u.\"Id\" order by u.\"Email\" limit @take offset @skip", new { skip, take });
        
        // Trim user IDs to handle whitespace issues
        foreach (var user in users)
        {
            if (user.Id != null)
                user.Id = user.Id.Trim();
        }
        return users;
    }

    public IEnumerable<User> Find(bool showAdminOnly, string? email, int skip, int take)
    {
        if (string.IsNullOrEmpty(email)) return Find(showAdminOnly, skip, take);
        email = $"%{email}%";
        IEnumerable<User> users;
        if (showAdminOnly)
            users = conn.Query<User>("select * from \"user\" where \"Role\" = 'Admin' and \"Email\" like @email order by \"Email\" limit @take offset @skip", new { email, skip, take });
        else
            users = conn.Query<User>("select * from \"user\" where \"Email\" like @email order by \"Email\" limit @take offset @skip", new { email, skip, take });
        
        // Trim user IDs to handle whitespace issues
        foreach (var user in users)
        {
            if (user.Id != null)
                user.Id = user.Id.Trim();
        }
        return users;
    }

    public User FindByEmail(string email)
    {
        var user = conn.QueryFirstOrDefault<User>("select * from \"user\" where \"Email\" = @email", new { email });
        // Trim the user's Id property if it was retrieved (in case database has trailing spaces)
        if (user != null && user.Id != null)
        {
            user.Id = user.Id.Trim();
        }
        return user;
    }

    public User? FindByKey(string apiKey)
    {
        return conn.QueryFirstOrDefault<User>("select * from \"user\" where \"ApiKey\" = @apiKey", new { apiKey });
    }

    public string? GenApiKey(string id)
    {
        var apiKey = Guid.NewGuid().ToString();
        var rows = conn.Execute("update \"user\" set \"ApiKey\" = @apiKey where \"Id\" = @id", new { id , apiKey});
        if (rows > 0)
            return apiKey;
        return null;
    }

    // Override Get to use explicit SQL with quoted identifiers for PostgreSQL
    // Note: Base class returns T (non-nullable) but QueryFirstOrDefault can return null
    public override User Get(string id)
    {
        if (string.IsNullOrEmpty(id))
            return null!;
        // Trim the id parameter to handle any trailing whitespace in the input
        var trimmedId = id.Trim();
        var user = conn.QueryFirstOrDefault<User>(
            "select * from \"user\" where \"Id\" = @trimmedId",
            new { trimmedId });
        // Also trim the user's Id property if it was retrieved (in case database has trailing spaces)
        if (user != null && user.Id != null)
        {
            user.Id = user.Id.Trim();
        }
        return user ?? null!;
    }

    // Override Update to use explicit SQL with quoted identifiers for PostgreSQL
    public override bool Update(User obj)
    {
        // Ensure DateTime values are UTC for PostgreSQL
        var createdAt = obj.CreatedAt.Kind == DateTimeKind.Utc ? obj.CreatedAt : obj.CreatedAt.ToUniversalTime();
        var modifiedAt = obj.ModifiedAt.Kind == DateTimeKind.Utc ? obj.ModifiedAt : obj.ModifiedAt.ToUniversalTime();
        
        return conn.Execute(
            "update \"user\" set \"Email\" = @Email, \"HashedPassword\" = @HashedPassword, \"Role\" = @Role::user_role, \"CreatedAt\" = @CreatedAt, \"ModifiedAt\" = @ModifiedAt, \"ApiKey\" = @ApiKey, \"Verified\" = @Verified where \"Id\" = @Id",
            new { 
                obj.Id, 
                obj.Email, 
                obj.HashedPassword, 
                obj.Role, 
                CreatedAt = createdAt, 
                ModifiedAt = modifiedAt, 
                obj.ApiKey, 
                obj.Verified 
            }) > 0;
    }

    // Override Insert to use explicit SQL with quoted identifiers for PostgreSQL
    public override long Insert(User obj)
    {
        // Cast Role to user_role ENUM type for PostgreSQL
        // Ensure DateTime values are UTC for PostgreSQL
        var createdAt = obj.CreatedAt.Kind == DateTimeKind.Utc ? obj.CreatedAt : obj.CreatedAt.ToUniversalTime();
        var modifiedAt = obj.ModifiedAt.Kind == DateTimeKind.Utc ? obj.ModifiedAt : obj.ModifiedAt.ToUniversalTime();
        
        return conn.Execute(
            "insert into \"user\" (\"Id\", \"Email\", \"HashedPassword\", \"Role\", \"CreatedAt\", \"ModifiedAt\", \"ApiKey\", \"Verified\") " +
            "values (@Id, @Email, @HashedPassword, @Role::user_role, @CreatedAt, @ModifiedAt, @ApiKey, @Verified)",
            new { 
                obj.Id, 
                obj.Email, 
                obj.HashedPassword, 
                obj.Role, 
                CreatedAt = createdAt, 
                ModifiedAt = modifiedAt, 
                obj.ApiKey, 
                obj.Verified 
            });
    }
}
