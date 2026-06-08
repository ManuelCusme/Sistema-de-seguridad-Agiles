using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Incidents.Data;
using UtaSecurity.Services.Incidents.Hubs;
using UtaSecurity.Services.Incidents.Models;
using UtaSecurity.Services.Incidents.Services;

namespace UtaSecurity.Services.Incidents.Controllers
{
    [ApiController]
    [Route("api/guard-duty")]
    public class GuardDutyController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<AlertHub> _hubContext;
        private readonly IAlertConnectionRegistry _connectionRegistry;

        public GuardDutyController(ApplicationDbContext context, IHubContext<AlertHub> hubContext, IAlertConnectionRegistry connectionRegistry)
        {
            _context = context;
            _hubContext = hubContext;
            _connectionRegistry = connectionRegistry;
        }

        [HttpGet("{usuId:guid}")]
        public async Task<IActionResult> GetStatus(Guid usuId)
        {
            var status = await _context.GuardDutyStatuses.AsNoTracking().FirstOrDefaultAsync(item => item.GuardUserId == usuId);
            return Ok(new
            {
                usuId,
                enServicio = status?.IsOnDuty ?? true,
                actualizadoEn = status?.UpdatedAt
            });
        }

        [HttpPut]
        public async Task<IActionResult> SetStatus([FromBody] GuardDutyStatusDto request)
        {
            if (!Guid.TryParse(request?.usuId, out var guardUserId))
            {
                return BadRequest(new { success = false, error = "Se requiere usuId valido." });
            }

            var status = await _context.GuardDutyStatuses.FirstOrDefaultAsync(item => item.GuardUserId == guardUserId);
            if (status == null)
            {
                status = new GuardDutyStatusEntity { GuardUserId = guardUserId };
                _context.GuardDutyStatuses.Add(status);
            }

            status.IsOnDuty = request!.enServicio;
            status.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // HU-12: actualiza las conexiones vivas para que el filtro SignalR aplique sin relogin.
            await _connectionRegistry.SetGuardDutyAsync(guardUserId, status.IsOnDuty, _hubContext);
            await _hubContext.Clients.Group(AlertConnectionRegistry.AdminsGroup).SendAsync("ReceiveGuardDutyUpdate", new
            {
                usuId = guardUserId,
                enServicio = status.IsOnDuty,
                actualizadoEn = status.UpdatedAt
            });

            return Ok(new { success = true, usuId = guardUserId, enServicio = status.IsOnDuty, actualizadoEn = status.UpdatedAt });
        }
    }
}
