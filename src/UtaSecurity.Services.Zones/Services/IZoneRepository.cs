using UtaSecurity.Services.Zones.Models;

namespace UtaSecurity.Services.Zones.Services
{
    public interface IZoneRepository
    {
        Task EnsureReadyAsync();
        Task<ZoneDetectionResult?> DetectAsync(double lat, double lng);
    }
}
