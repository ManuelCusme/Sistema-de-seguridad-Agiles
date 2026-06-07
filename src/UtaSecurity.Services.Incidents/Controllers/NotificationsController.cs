using Microsoft.AspNetCore.Mvc;
using UtaSecurity.Services.Incidents.Models;
using UtaSecurity.Services.Incidents.Services;

namespace UtaSecurity.Services.Incidents.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationsController : ControllerBase
    {
        [HttpPost("register-token")]
        public IActionResult RegisterToken([FromBody] PushTokenRegistrationDto request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Token))
            {
                return BadRequest(new { success = false, error = "El token push es requerido." });
            }

            ExpoPushNotificationService.Register(request);

            return Ok(new
            {
                success = true,
                tokensRegistrados = ExpoPushNotificationService.TokenCount
            });
        }

        [HttpGet("status")]
        public IActionResult GetStatus()
        {
            return Ok(new
            {
                success = true,
                tokensRegistrados = ExpoPushNotificationService.TokenCount
            });
        }
    }
}
