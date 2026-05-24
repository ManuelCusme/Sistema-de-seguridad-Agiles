using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Incidents.Data;
using UtaSecurity.Services.Incidents.Models;

namespace UtaSecurity.Services.Incidents.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ZonesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public ZonesController(ApplicationDbContext db)
        {
            _db = db;
        }

        // GET api/zones/detect?lat={lat}&lng={lng}
        [HttpGet("detect")]
        public async Task<IActionResult> Detect([FromQuery] double lat, [FromQuery] double lng)
        {
            var geofences = await _db.Geofences.ToListAsync();

            GeofenceEntity? found = null;
            double foundDistance = double.MaxValue;

            foreach (var g in geofences)
            {
                var d = HaversineDistanceMeters(lat, lng, g.Latitude, g.Longitude);
                if (d <= g.Radius)
                {
                    found = g;
                    foundDistance = d;
                    break;
                }
                if (d < foundDistance)
                    foundDistance = d;
            }

            if (found != null)
            {
                return Ok(new { found = true, name = found.Name, distance = Math.Round(foundDistance, 2) });
            }

            return Ok(new { found = false, distanceToNearest = Math.Round(foundDistance, 2) });
        }

        private double HaversineDistanceMeters(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371000; // Earth radius in meters
            var dLat = ToRad(lat2 - lat1);
            var dLon = ToRad(lon2 - lon1);
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return R * c;
        }

        private double ToRad(double deg) => deg * Math.PI / 180.0;
    }
}
