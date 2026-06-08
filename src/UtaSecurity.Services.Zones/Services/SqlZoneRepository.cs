using Microsoft.Data.SqlClient;
using UtaSecurity.Services.Zones.Models;

namespace UtaSecurity.Services.Zones.Services
{
    public sealed class SqlZoneRepository : IZoneRepository
    {
        private readonly string _connectionString;
        private readonly ILogger<SqlZoneRepository> _logger;
        private sealed record ZoneShape(string Code, string Name, (double Lat, double Lng)[] Points);

        private static readonly ZoneShape[] CampusZones =
        [
            new("Z1", "FACULTAD DE INGENIERIA", [
                (-1.266416, -78.625301),
                (-1.266480, -78.624212),
                (-1.268564, -78.624212),
                (-1.268564, -78.625840)
            ]),
            new("Z2", "BIBLIOTECA GENERAL", [
                (-1.266480, -78.624212),
                (-1.266555, -78.622994),
                (-1.268564, -78.622640),
                (-1.268564, -78.624212)
            ]),
            new("Z3", "RECTORADO / ADMINISTRACION", [
                (-1.268564, -78.625840),
                (-1.268564, -78.624212),
                (-1.270650, -78.624212),
                (-1.270376, -78.626380)
            ]),
            new("Z4", "COMPLEJO DEPORTIVO", [
                (-1.268564, -78.624212),
                (-1.268564, -78.622640),
                (-1.270935, -78.622289),
                (-1.270650, -78.624212)
            ])
        ];

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
MERGE INTO dbo.Geofences AS target
USING (VALUES
    ('Z1', 'FACULTAD DE INGENIERÍA', geography::STPolyFromText('POLYGON ((-78.625301 -1.266416, -78.624212 -1.26648, -78.624212 -1.268564, -78.62584 -1.268564, -78.625301 -1.266416))', 4326), -1.267490, -78.624756, 200),
    ('Z2', 'BIBLIOTECA GENERAL', geography::STPolyFromText('POLYGON ((-78.624212 -1.26648, -78.622994 -1.266555, -78.62264 -1.268564, -78.624212 -1.268564, -78.624212 -1.26648))', 4326), -1.267525, -78.623603, 200),
    ('Z3', 'RECTORADO / ADMINISTRACIÓN', geography::STPolyFromText('POLYGON ((-78.62584 -1.268564, -78.624212 -1.268564, -78.624212 -1.27065, -78.62638 -1.270376, -78.62584 -1.268564))', 4326), -1.269470, -78.625026, 200),
    ('Z4', 'COMPLEJO DEPORTIVO', geography::STPolyFromText('POLYGON ((-78.624212 -1.268564, -78.62264 -1.268564, -78.622289 -1.270935, -78.624212 -1.27065, -78.624212 -1.268564))', 4326), -1.269750, -78.623427, 200)
) AS source (Code, Name, Boundary, Latitude, Longitude, Radius)
ON target.Code = source.Code
WHEN MATCHED THEN
    UPDATE SET
        Name = source.Name,
        Boundary = source.Boundary,
        Latitude = source.Latitude,
        Longitude = source.Longitude,
        Radius = source.Radius
WHEN NOT MATCHED THEN
    INSERT (Id, Code, Name, Boundary, Latitude, Longitude, Radius)
    VALUES (NEWID(), source.Code, source.Name, source.Boundary, source.Latitude, source.Longitude, source.Radius);

DELETE FROM dbo.Geofences WHERE Code = 'Z5';";

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
ORDER BY Radius ASC, Code;";

            await using var command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@Lat", lat);
            command.Parameters.AddWithValue("@Lng", lng);

            await using var reader = await command.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
            {
                var fallbackZone = DetectByCoordinates(lat, lng);
                if (fallbackZone is not null)
                {
                    _logger.LogInformation("SQL geography did not match coordinates ({Lat}, {Lng}); fallback matched {Code}.", lat, lng, fallbackZone.Code);
                    return new ZoneDetectionResult
                    {
                        Code = fallbackZone.Code,
                        Name = fallbackZone.Name
                    };
                }

                _logger.LogInformation("No geofence matched coordinates ({Lat}, {Lng}).", lat, lng);
                return null;
            }

            return new ZoneDetectionResult
            {
                Code = reader.GetString(0),
                Name = reader.GetString(1)
            };
        }

        private static ZoneShape? DetectByCoordinates(double latitude, double longitude)
        {
            if (latitude == 0 && longitude == 0)
            {
                return null;
            }

            return CampusZones.FirstOrDefault(zone => IsPointInPolygon(latitude, longitude, zone.Points));
        }

        private static bool IsPointInPolygon(double latitude, double longitude, (double Lat, double Lng)[] polygon)
        {
            var inside = false;
            for (int i = 0, j = polygon.Length - 1; i < polygon.Length; j = i++)
            {
                var yi = polygon[i].Lat;
                var xi = polygon[i].Lng;
                var yj = polygon[j].Lat;
                var xj = polygon[j].Lng;

                var intersects = (yi > latitude) != (yj > latitude)
                    && longitude < ((xj - xi) * (latitude - yi) / (yj - yi)) + xi;
                if (intersects)
                {
                    inside = !inside;
                }
            }

            return inside;
        }
    }
}
