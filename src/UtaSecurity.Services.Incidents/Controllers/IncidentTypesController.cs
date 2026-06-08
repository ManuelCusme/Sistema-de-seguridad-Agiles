using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Incidents.Data;
using UtaSecurity.Services.Incidents.Hubs;
using UtaSecurity.Services.Incidents.Models;

namespace UtaSecurity.Services.Incidents.Controllers
{
    [ApiController]
    [Route("api/incident-types")]
    public class IncidentTypesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<AlertHub> _hubContext;

        public IncidentTypesController(ApplicationDbContext context, IHubContext<AlertHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        [HttpGet]
        public async Task<IActionResult> GetTypes([FromQuery] bool includeInactive = false)
        {
            var query = _context.IncidentTypes.AsNoTracking();
            if (!includeInactive)
            {
                query = query.Where(item => item.IsActive);
            }

            var types = await query
                .OrderBy(item => item.Name)
                .Select(item => new
                {
                    id = item.Id,
                    nombre = item.Name,
                    codigo = item.Code,
                    emoji = item.Emoji,
                    color = item.Color,
                    activo = item.IsActive
                })
                .ToListAsync();

            return Ok(types);
        }

        [HttpPost]
        public async Task<IActionResult> CreateType([FromBody] IncidentTypeUpsertDto request)
        {
            var normalized = Normalize(request);
            if (normalized.Error != null)
            {
                return BadRequest(new { success = false, error = normalized.Error });
            }

            var exists = await _context.IncidentTypes.AnyAsync(item => item.Code == normalized.Code);
            if (exists)
            {
                return BadRequest(new { success = false, error = "Ya existe un tipo con ese codigo." });
            }

            var type = new IncidentTypeEntity
            {
                Name = normalized.Name!,
                Code = normalized.Code!,
                Emoji = normalized.Emoji!,
                Color = normalized.Color!,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.IncidentTypes.Add(type);
            await _context.SaveChangesAsync();

            await NotifyIncidentTypesChangedAsync("created", type);
            return Ok(new { success = true, id = type.Id });
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdateType(Guid id, [FromBody] IncidentTypeUpsertDto request)
        {
            var type = await _context.IncidentTypes.FirstOrDefaultAsync(item => item.Id == id);
            if (type == null)
            {
                return NotFound(new { success = false, error = "No se encontro el tipo solicitado." });
            }

            var normalized = Normalize(request);
            if (normalized.Error != null)
            {
                return BadRequest(new { success = false, error = normalized.Error });
            }

            var duplicated = await _context.IncidentTypes.AnyAsync(item => item.Id != id && item.Code == normalized.Code);
            if (duplicated)
            {
                return BadRequest(new { success = false, error = "Ya existe otro tipo con ese codigo." });
            }

            type.Name = normalized.Name!;
            type.Code = normalized.Code!;
            type.Emoji = normalized.Emoji!;
            type.Color = normalized.Color!;
            type.IsActive = true;
            type.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await NotifyIncidentTypesChangedAsync("updated", type);
            return Ok(new { success = true });
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteType(Guid id)
        {
            var type = await _context.IncidentTypes.FirstOrDefaultAsync(item => item.Id == id);
            if (type == null)
            {
                return NotFound(new { success = false, error = "No se encontro el tipo solicitado." });
            }

            type.IsActive = false;
            type.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await NotifyIncidentTypesChangedAsync("deleted", type);
            return Ok(new { success = true });
        }

        private Task NotifyIncidentTypesChangedAsync(string action, IncidentTypeEntity type)
        {
            return _hubContext.Clients.All.SendAsync("ReceiveIncidentTypesChanged", new
            {
                action,
                type = new
                {
                    id = type.Id,
                    nombre = type.Name,
                    codigo = type.Code,
                    emoji = type.Emoji,
                    color = type.Color,
                    activo = type.IsActive
                }
            });
        }

        private static (string? Name, string? Code, string? Emoji, string? Color, string? Error) Normalize(IncidentTypeUpsertDto? request)
        {
            var name = request?.nombre?.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return (null, null, null, null, "El nombre del tipo es obligatorio.");
            }

            var code = string.IsNullOrWhiteSpace(request?.codigo)
                ? name.ToUpperInvariant().Replace(" ", "_")
                : request!.codigo.Trim().ToUpperInvariant();

            var emoji = string.IsNullOrWhiteSpace(request?.emoji) ? "\U0001F6A8" : request!.emoji.Trim();
            var color = string.IsNullOrWhiteSpace(request?.color) ? "#4d82ff" : request!.color.Trim();

            return (name, code, emoji, color, null);
        }
    }
}
