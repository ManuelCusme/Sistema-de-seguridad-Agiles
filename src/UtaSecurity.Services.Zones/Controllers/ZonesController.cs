using Microsoft.AspNetCore.Mvc;
using UtaSecurity.Services.Zones.Services;

namespace UtaSecurity.Services.Zones.Controllers
{
    [ApiController]
    public class ZonesController : ControllerBase
    {
        private readonly IZoneRepository _repository;

        public ZonesController(IZoneRepository repository)
        {
            _repository = repository;
        }

        [HttpGet("api/zones/detect")]
        [HttpGet("zones/detect")]
        [HttpGet("zonas/detectar")]
        public async Task<IActionResult> Detect([FromQuery] double lat, [FromQuery] double lng)
        {
            var zone = await _repository.DetectAsync(lat, lng);

            if (zone is null)
            {
                return Ok("No disponible");
            }

            return Ok(zone.Name);
        }
    }
}
