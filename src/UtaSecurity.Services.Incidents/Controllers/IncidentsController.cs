// INCIDENTSCONTROLLER.CS — CONTROLADOR DEL MICROSERVICIO DE INCIDENTES
// Microservicio: UtaSecurity.Services.Incidents
// Responsable: Emilio Abril (EMILIOABRIL05)
// Reemplaza el IncidentController del prototipo eliminando acoplamientos:
//   - Elimina acceso directo a ApplicationDbContext (sin EF Core en Sprint 1)
//   - Elimina lógica Haversine del controlador (la calcula el cliente por ahora)
//   - Elimina dependencia de JWT del microservicio de incidentes

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
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
            // Validación mínima: coordenadas obligatorias para la geolocalización
            if (objNuevaAlerta.incLatitud == 0 && objNuevaAlerta.incLongitud == 0)
            {
                return BadRequest(new
                {
                    error = "Las coordenadas son obligatorias.",
                    campos = new[] { "incLatitud", "incLongitud" }
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
                    UserId = Guid.Empty, // En el Sprint 1 no estamos vinculando el ID real aún, se puede mejorar luego
                    Latitude = objNuevaAlerta.incLatitud,
                    Longitude = objNuevaAlerta.incLongitud,
                    GeofenceName = objNuevaAlerta.incGeocercaNombre,
                    Motivo = objNuevaAlerta.incMotivo,
                    Timestamp = objNuevaAlerta.incFechaReporte
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
                mensaje = "Alerta de incidente registrada y transmitida exitosamente.",
                data = objNuevaAlerta
            });
        }
    }
}
