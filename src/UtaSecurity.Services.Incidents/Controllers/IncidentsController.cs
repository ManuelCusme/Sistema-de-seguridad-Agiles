// INCIDENTSCONTROLLER.CS — CONTROLADOR DEL MICROSERVICIO DE INCIDENTES
// Microservicio: UtaSecurity.Services.Incidents
// Responsable: Emilio Abril (EMILIOABRIL05)
// Reemplaza el IncidentController del prototipo eliminando acoplamientos:
//   - Elimina acceso directo a ApplicationDbContext (sin EF Core en Sprint 1)
//   - Elimina lógica Haversine del controlador (la calcula el cliente por ahora)
//   - Elimina dependencia de JWT del microservicio de incidentes

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Incidents.Hubs;
using UtaSecurity.Services.Incidents.Models;
using UtaSecurity.Services.Incidents.Data;

namespace UtaSecurity.Services.Incidents.Controllers
{
    /// <summary>
    /// Endpoint HTTP para recibir alertas de pánico y retransmitirlas por SignalR.
    /// Flujo: App Móvil → Gateway (5000) → MS-C (5003) → AlertHub → Guardias/Admin
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class IncidentsController : ControllerBase
    {
        private readonly IHubContext<AlertHub> _hubContext;
        private readonly ApplicationDbContext _context;

        public IncidentsController(IHubContext<AlertHub> hubContext, ApplicationDbContext context)
        {
            _hubContext = hubContext;
            _context = context;
        }

        /// <summary>
        /// Registra un nuevo incidente de seguridad y lo transmite inmediatamente por WebSocket.
        /// Reemplaza el endpoint POST /api/incident/panic del prototipo original.
        /// </summary>
        /// <param name="objNuevaAlerta">Datos de la alerta enviados desde la app móvil.</param>
        /// <returns>HTTP 200 con los datos procesados, o HTTP 400 si faltan coordenadas.</returns>
        [HttpPost]
        public async Task<IActionResult> PostIncident([FromBody] IncidentDto objNuevaAlerta)
        {
            if (objNuevaAlerta == null)
            {
                return BadRequest(new
                {
                    error = "El cuerpo del incidente es requerido."
                });
            }

            // Validación mínima: coordenadas obligatorias para la geolocalización
            if (objNuevaAlerta.incLatitud == 0 && objNuevaAlerta.incLongitud == 0)
            {
                return BadRequest(new
                {
                    error = "Las coordenadas son obligatorias.",
                    campos = new[] { "incLatitud", "incLongitud" }
                });
            }

            if (string.IsNullOrWhiteSpace(objNuevaAlerta.incUsuarioId) || !Guid.TryParse(objNuevaAlerta.incUsuarioId, out var usuId))
            {
                return BadRequest(new
                {
                    error = "Se requiere un incUsuarioId válido para guardar el incidente en la base de datos."
                });
            }

            // Asignar datos de control desde el servidor (no confiar en valores del cliente)
            objNuevaAlerta.incId = Guid.NewGuid().ToString();
            objNuevaAlerta.incFechaReporte = DateTime.UtcNow;

            // Transmitir la alerta a todos los guardias conectados por WebSocket
            await _hubContext.Clients.All.SendAsync("ReceiveAlert", objNuevaAlerta);

            // Guardar en Base de Datos
            try
            {
                var entity = new IncidentEntity
                {
                    Id = Guid.Parse(objNuevaAlerta.incId),
                    UserId = usuId,
                    Latitude = objNuevaAlerta.incLatitud,
                    Longitude = objNuevaAlerta.incLongitud,
                    GeofenceName = objNuevaAlerta.incGeocercaNombre,
                    Motivo = objNuevaAlerta.incMotivo,
                    Timestamp = objNuevaAlerta.incFechaReporte,
                    Status = "PENDIENTE"
                };
                _context.Incidents.Add(entity);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Log error but don't stop the real-time alert
                Console.WriteLine($"Error al guardar incidente: {ex.Message}");
            }

            // Retornar confirmación con los datos del incidente procesado
            return Ok(new
            {
                success = true,
                mensaje = "Alerta de incidente registrada y transmitida exitosamente.",
                data = objNuevaAlerta
            });
        }

        [HttpPost("accept")]
        public async Task<IActionResult> AcceptIncident([FromBody] IncidentActionDto request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.incId) || !Guid.TryParse(request.incId, out var incidentId))
            {
                return BadRequest(new { success = false, error = "El identificador del incidente es requerido." });
            }

            var incident = await _context.Incidents.FirstOrDefaultAsync(item => item.Id == incidentId);
            if (incident == null)
            {
                return NotFound(new { success = false, error = "No se encontró el incidente solicitado." });
            }

            if (string.Equals(incident.Status, "CERRADO", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { success = false, error = "El incidente ya fue cerrado." });
            }

            incident.Status = "ASIGNADO";
            incident.AssignedAt = DateTime.UtcNow;
            incident.AssignedByUserId = Guid.TryParse(request.usuId, out var assignedByUserId) ? assignedByUserId : null;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                mensaje = "Incidente aceptado correctamente.",
                data = new
                {
                    incId = incident.Id.ToString(),
                    estado = incident.Status,
                    asignadoEn = incident.AssignedAt,
                    asignadoPor = incident.AssignedByUserId?.ToString()
                }
            });
        }

        [HttpPost("close")]
        public async Task<IActionResult> CloseIncident([FromBody] IncidentActionDto request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.incId) || !Guid.TryParse(request.incId, out var incidentId))
            {
                return BadRequest(new { success = false, error = "El identificador del incidente es requerido." });
            }

            if (string.IsNullOrWhiteSpace(request.incObservacion) || request.incObservacion.Trim().Length < 20)
            {
                return BadRequest(new { success = false, error = "La observación de cierre debe tener al menos 20 caracteres." });
            }

            var incident = await _context.Incidents.FirstOrDefaultAsync(item => item.Id == incidentId);
            if (incident == null)
            {
                return NotFound(new { success = false, error = "No se encontró el incidente solicitado." });
            }

            incident.Status = "CERRADO";
            incident.ClosedAt = DateTime.UtcNow;
            incident.ClosedByUserId = Guid.TryParse(request.usuId, out var closedByUserId) ? closedByUserId : null;
            incident.CloseObservation = request.incObservacion.Trim();

            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                mensaje = "Incidente cerrado correctamente.",
                data = new
                {
                    incId = incident.Id.ToString(),
                    estado = incident.Status,
                    cerradoEn = incident.ClosedAt,
                    cerradoPor = incident.ClosedByUserId?.ToString(),
                    incObservacion = incident.CloseObservation
                }
            });
        }
    }
}
