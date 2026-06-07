using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Incidents.Data;
using UtaSecurity.Services.Incidents.Models;

namespace UtaSecurity.Services.Incidents.Controllers
{
    [ApiController]
    [Route("api/guard-rounds")]
    public class GuardRoundsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public GuardRoundsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetRounds([FromQuery] string? usuId)
        {
            var query = _context.GuardRounds.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(usuId))
            {
                if (!Guid.TryParse(usuId, out var guardUserId))
                {
                    return BadRequest(new { success = false, error = "usuId invalido." });
                }

                query = query.Where(item => item.GuardUserId == guardUserId);
            }

            var rounds = await query
                .OrderByDescending(item => item.StartedAt)
                .Select(item => new
                {
                    rondaId = item.Id,
                    guardiaId = item.GuardUserId,
                    zona = item.Zone,
                    horaInicio = item.StartedAt,
                    horaFin = item.EndedAt,
                    observacion = item.Observation,
                    duracionMinutos = item.DurationMinutes,
                    estado = item.Status
                })
                .ToListAsync();

            return Ok(rounds);
        }

        [HttpPost("start")]
        public async Task<IActionResult> StartRound([FromBody] GuardRoundStartDto request)
        {
            if (!Guid.TryParse(request?.usuId, out var guardUserId))
            {
                return BadRequest(new { success = false, error = "Se requiere usuId valido." });
            }

            var zone = request?.zona?.Trim();
            if (string.IsNullOrWhiteSpace(zone))
            {
                return BadRequest(new { success = false, error = "Debe seleccionar una zona para iniciar la ronda." });
            }

            var hasOpenRound = await _context.GuardRounds.AnyAsync(item => item.GuardUserId == guardUserId && item.Status == "EN_CURSO");
            if (hasOpenRound)
            {
                return BadRequest(new { success = false, error = "Ya existe una ronda en curso para este guardia." });
            }

            var round = new GuardRoundEntity
            {
                GuardUserId = guardUserId,
                Zone = zone,
                StartedAt = DateTime.UtcNow,
                Status = "EN_CURSO"
            };

            _context.GuardRounds.Add(round);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, rondaId = round.Id, horaInicio = round.StartedAt, estado = round.Status });
        }

        [HttpPost("finish")]
        public async Task<IActionResult> FinishRound([FromBody] GuardRoundFinishDto request)
        {
            if (!Guid.TryParse(request?.rondaId, out var roundId) || !Guid.TryParse(request?.usuId, out var guardUserId))
            {
                return BadRequest(new { success = false, error = "Se requiere rondaId y usuId validos." });
            }

            var observation = request?.observacion?.Trim();
            if (string.IsNullOrWhiteSpace(observation))
            {
                return BadRequest(new { success = false, error = "La observacion de cierre de ronda es obligatoria." });
            }

            var round = await _context.GuardRounds.FirstOrDefaultAsync(item => item.Id == roundId && item.GuardUserId == guardUserId);
            if (round == null)
            {
                return NotFound(new { success = false, error = "No se encontro la ronda solicitada." });
            }

            if (round.Status == "FINALIZADA")
            {
                return BadRequest(new { success = false, error = "La ronda ya fue finalizada." });
            }

            round.EndedAt = DateTime.UtcNow;
            round.Observation = observation;
            round.DurationMinutes = Math.Max(0, (int)Math.Ceiling((round.EndedAt.Value - round.StartedAt).TotalMinutes));
            round.Status = "FINALIZADA";

            await _context.SaveChangesAsync();
            return Ok(new
            {
                success = true,
                rondaId = round.Id,
                horaFin = round.EndedAt,
                duracionMinutos = round.DurationMinutes,
                observacion = round.Observation
            });
        }
    }
}
