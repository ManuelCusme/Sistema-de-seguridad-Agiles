using Microsoft.Data.SqlClient;
using UtaSecurity.Services.Zones.Models;

namespace UtaSecurity.Services.Zones.Services
{
    public sealed class SqlZoneRepository : IZoneRepository
    {
        private readonly string _connectionString;
        private readonly ILogger<SqlZoneRepository> _logger;

        public SqlZoneRepository(IConfiguration configuration, ILogger<SqlZoneRepository> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("Missing DefaultConnection.");
            _logger = logger;
        }

        public async Task EnsureReadyAsync()
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync();

            var schemaSql = @"
IF OBJECT_ID('dbo.Geofences', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Geofences
    (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Geofences PRIMARY KEY DEFAULT NEWID(),
        Code NVARCHAR(10) NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        Boundary GEOGRAPHY NOT NULL,
        Latitude FLOAT NULL,
        Longitude FLOAT NULL,
        Radius FLOAT NULL
    );
END
ELSE
BEGIN
    IF COL_LENGTH('dbo.Geofences', 'Code') IS NULL
    BEGIN
        ALTER TABLE dbo.Geofences ADD Code NVARCHAR(10) NULL;
    END;

    IF COL_LENGTH('dbo.Geofences', 'Boundary') IS NULL
    BEGIN
        ALTER TABLE dbo.Geofences ADD Boundary GEOGRAPHY NULL;
    END;
END
";

            await using var schemaCommand = new SqlCommand(schemaSql, connection);
            await schemaCommand.ExecuteNonQueryAsync();

            var seedSql = @"
IF NOT EXISTS (SELECT 1 FROM dbo.Geofences WHERE Boundary IS NOT NULL)
BEGIN
    INSERT INTO dbo.Geofences (Id, Code, Name, Boundary, Latitude, Longitude, Radius)
    VALUES
        (NEWID(), 'Z1', 'FACULTAD DE INGENIERÍA', geography::STPolyFromText('POLYGON ((-78.625301 -1.266416, -78.624212 -1.26648, -78.624212 -1.268564, -78.62584 -1.268564, -78.625301 -1.266416))', 4326), -1.267490, -78.624756, 200),
        (NEWID(), 'Z2', 'BIBLIOTECA GENERAL', geography::STPolyFromText('POLYGON ((-78.624212 -1.26648, -78.622994 -1.266555, -78.62264 -1.268564, -78.624212 -1.268564, -78.624212 -1.26648))', 4326), -1.267525, -78.623603, 200),
        (NEWID(), 'Z3', 'RECTORADO / ADMINISTRACIÓN', geography::STPolyFromText('POLYGON ((-78.62584 -1.268564, -78.624212 -1.268564, -78.624212 -1.27065, -78.62638 -1.270376, -78.62584 -1.268564))', 4326), -1.269470, -78.625026, 200),
        (NEWID(), 'Z4', 'COMPLEJO DEPORTIVO', geography::STPolyFromText('POLYGON ((-78.624212 -1.268564, -78.62264 -1.268564, -78.622289 -1.270935, -78.624212 -1.27065, -78.624212 -1.268564))', 4326), -1.269750, -78.623427, 200);
END";

            await using var seedCommand = new SqlCommand(seedSql, connection);
            await seedCommand.ExecuteNonQueryAsync();
        }

        public async Task<ZoneDetectionResult?> DetectAsync(double lat, double lng)
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync();

            const string sql = @"
SELECT TOP 1 Code, Name
FROM dbo.Geofences
WHERE Boundary IS NOT NULL
  AND Boundary.STContains(geography::Point(@Lat, @Lng, 4326)) = 1
ORDER BY Code;";

            await using var command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@Lat", lat);
            command.Parameters.AddWithValue("@Lng", lng);

            await using var reader = await command.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
            {
                _logger.LogInformation("No geofence matched coordinates ({Lat}, {Lng}).", lat, lng);
                return null;
            }

            return new ZoneDetectionResult
            {
                Code = reader.GetString(0),
                Name = reader.GetString(1)
            };
        }
    }
}
