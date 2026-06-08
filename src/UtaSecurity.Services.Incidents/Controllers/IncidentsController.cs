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
using UtaSecurity.Services.Incidents.Services;
using System.Globalization;
using System.Text;

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
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<IncidentsController> _logger;

        public IncidentsController(IHubContext<AlertHub> hubContext, ApplicationDbContext context, IHttpClientFactory httpClientFactory, ILogger<IncidentsController> logger)
        {
            _hubContext = hubContext;
            _context = context;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
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

            string zonaDetectada = "No disponible";
            string geocercaDetectada = objNuevaAlerta.incGeocercaNombre;

            if (objNuevaAlerta.incLatitud == 0 && objNuevaAlerta.incLongitud == 0)
            {
                _logger.LogWarning("Alerta recibida sin coordenadas GPS. No se puede detectar zona.");
            }
            else
            {
                // Llamada al MS-C para detectar la zona (TA-06.4)
                try
                {
                    var client = _httpClientFactory.CreateClient("ZoneService");
                    var response = await client.GetAsync($"/zonas/detectar?lat={objNuevaAlerta.incLatitud}&lng={objNuevaAlerta.incLongitud}");
                    
                    if (response.IsSuccessStatusCode)
                    {
                        var result = await response.Content.ReadAsStringAsync();
                        if (!string.IsNullOrWhiteSpace(result))
                        {
                            // Limpiar comillas y espacios en caso de que la respuesta sea un string JSON ("Campus Huachi" -> Campus Huachi)
                            zonaDetectada = result.Trim('"', ' ', '\n', '\r');
                            if (!IsUnknownZone(zonaDetectada))
                            {
                                geocercaDetectada = zonaDetectada;
                            }
                        }
                    }
                    else
                    {
                        _logger.LogWarning($"MS-C de Zonas devolvió error o no encontró zona: {response.StatusCode}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Error al contactar MS-C de Zonas: {ex.Message}");
                }
            }

            zonaDetectada = NormalizeZoneLabel(zonaDetectada, geocercaDetectada, objNuevaAlerta.incLatitud, objNuevaAlerta.incLongitud);
            objNuevaAlerta.incZona = zonaDetectada;
            objNuevaAlerta.incGeocercaNombre = string.IsNullOrWhiteSpace(geocercaDetectada) ? zonaDetectada : geocercaDetectada;

            // HU-10/HU-12: enviar a administradores, guardias en servicio y miembros de confianza.
            var notificationGroups = await GetIncidentNotificationGroupsAsync(usuId);
            await _hubContext.Clients.Groups(notificationGroups).SendAsync("ReceiveAlert", objNuevaAlerta);
            await ExpoPushNotificationService.NotifyIncidentAsync(_httpClientFactory, objNuevaAlerta, _logger);

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
                    Zona = zonaDetectada,
                    Status = "PENDIENTE"
                };
                _context.Incidents.Add(entity);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Log error but don't stop the real-time alert
                _logger.LogError($"Error al guardar incidente: {ex.Message}");
            }

            // Retornar confirmación con los datos del incidente procesado
            return Ok(new
            {
                success = true,
                mensaje = "Alerta de incidente registrada y transmitida exitosamente.",
                data = objNuevaAlerta
            });
        }

        private async Task<IReadOnlyList<string>> GetIncidentNotificationGroupsAsync(Guid reporterUserId)
        {
            var groups = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                AlertConnectionRegistry.GuardsOnDutyGroup,
                AlertConnectionRegistry.AdminsGroup
            };

            // 1. Si el reportero es el dueño de algún grupo de confianza: obtener todos los miembros activos
            var membersOfOwnedGroups = await _context.TrustGroups
                .AsNoTracking()
                .Where(group => group.OwnerUserId == reporterUserId && group.IsActive)
                .SelectMany(group => group.Members.Where(m => m.IsActive).Select(m => m.MemberUserId))
                .Distinct()
                .ToListAsync();

            // 2. Si el reportero es miembro de algún grupo de confianza: obtener el dueño de ese grupo
            var ownersOfJoinedGroups = await _context.TrustGroupMembers
                .AsNoTracking()
                .Where(member => member.MemberUserId == reporterUserId && member.IsActive && member.TrustGroup.IsActive)
                .Select(member => member.TrustGroup.OwnerUserId)
                .Distinct()
                .ToListAsync();

            // 3. Si el reportero es miembro de algún grupo de confianza: obtener los demás compañeros del mismo grupo
            var coMembersOfJoinedGroups = await _context.TrustGroupMembers
                .AsNoTracking()
                .Where(member => member.MemberUserId == reporterUserId && member.IsActive && member.TrustGroup.IsActive)
                .SelectMany(member => member.TrustGroup.Members.Where(m => m.IsActive && m.MemberUserId != reporterUserId).Select(m => m.MemberUserId))
                .Distinct()
                .ToListAsync();

            // Combinar todos los destinatarios en un solo conjunto de IDs únicos
            var targetUserIds = new HashSet<Guid>();
            foreach (var id in membersOfOwnedGroups) targetUserIds.Add(id);
            foreach (var id in ownersOfJoinedGroups) targetUserIds.Add(id);
            foreach (var id in coMembersOfJoinedGroups) targetUserIds.Add(id);

            // Agregar el prefijo de grupo SignalR para cada usuario de confianza destinatario
            foreach (var userId in targetUserIds)
            {
                groups.Add($"{AlertConnectionRegistry.TrustUserGroupPrefix}{userId}");
            }

            return groups.ToList();
        }

        [HttpGet]
        public async Task<IActionResult> GetIncidents()
        {
            var incidentEntities = await _context.Incidents
                .OrderByDescending(item => item.Timestamp)
                .ToListAsync();

            var incidents = incidentEntities
                .Select(item => new
                {
                    incId = item.Id.ToString(),
                    incUsuarioId = item.UserId,
                    incMotivo = item.Motivo,
                    incZona = NormalizeZoneLabel(item.Zona, item.GeofenceName, item.Latitude, item.Longitude),
                    incGeocercaNombre = item.GeofenceName,
                    incReportadoPor = "Usuario institucional",
                    incFacultad = "UTA",
                    incSeveridad = item.Status,
                    incEstado = item.Status,
                    incLatitud = item.Latitude,
                    incLongitud = item.Longitude,
                    incFechaReporte = item.Timestamp,
                    incAsignadoPor = item.AssignedByUserId,
                    incAsignadoEn = item.AssignedAt,
                    incCerradoPor = item.ClosedByUserId,
                    incCerradoEn = item.ClosedAt,
                    incObservacion = item.CloseObservation
                })
                .ToList();

            return Ok(incidents);
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

            var zonaNormalizada = NormalizeZoneLabel(incident.Zona, incident.GeofenceName, incident.Latitude, incident.Longitude);

            await _hubContext.Clients.All.SendAsync("ReceiveIncidentUpdate", new
            {
                incId = incident.Id.ToString(),
                incEstado = incident.Status,
                incAsignadoPor = incident.AssignedByUserId?.ToString(),
                incAsignadoEn = incident.AssignedAt,
                incZona = zonaNormalizada,
                incGeocercaNombre = incident.GeofenceName,
                incObservacion = incident.CloseObservation
            });

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

            var zonaNormalizada = NormalizeZoneLabel(incident.Zona, incident.GeofenceName, incident.Latitude, incident.Longitude);

            await _hubContext.Clients.All.SendAsync("ReceiveIncidentUpdate", new
            {
                incId = incident.Id.ToString(),
                incEstado = incident.Status,
                incCerradoPor = incident.ClosedByUserId?.ToString(),
                incCerradoEn = incident.ClosedAt,
                incAsignadoPor = incident.AssignedByUserId?.ToString(),
                incAsignadoEn = incident.AssignedAt,
                incZona = zonaNormalizada,
                incGeocercaNombre = incident.GeofenceName,
                incObservacion = incident.CloseObservation
            });

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

        private sealed record ZoneShape(string Label, string[] Hints, (double Lat, double Lng)[] Points);

        private static readonly ZoneShape[] CampusZones =
        [
            new("Zona 1", ["Z1", "ZONA 1", "INGEN"], [
                (-1.266416, -78.625301),
                (-1.266480, -78.624212),
                (-1.268564, -78.624212),
                (-1.268564, -78.625840)
            ]),
            new("Zona 2", ["Z2", "ZONA 2", "BIBLI"], [
                (-1.266480, -78.624212),
                (-1.266555, -78.622994),
                (-1.268564, -78.622640),
                (-1.268564, -78.624212)
            ]),
            new("Zona 3", ["Z3", "ZONA 3", "RECTOR", "ADMIN"], [
                (-1.268564, -78.625840),
                (-1.268564, -78.624212),
                (-1.270650, -78.624212),
                (-1.270376, -78.626380)
            ]),
            new("Zona 4", ["Z4", "ZONA 4", "DEPOR"], [
                (-1.268564, -78.624212),
                (-1.268564, -78.622640),
                (-1.270935, -78.622289),
                (-1.270650, -78.624212)
            ])
        ];

        private static string NormalizeZoneLabel(string? zone, string? geofence, double latitude, double longitude)
        {
            var fromText = ZoneFromText(zone) ?? ZoneFromText(geofence);
            if (!string.IsNullOrWhiteSpace(fromText))
            {
                return fromText;
            }

            var fromCoordinates = ZoneFromCoordinates(latitude, longitude);
            if (!string.IsNullOrWhiteSpace(fromCoordinates))
            {
                return fromCoordinates;
            }

            return string.IsNullOrWhiteSpace(zone) ? "No disponible" : zone;
        }

        private static string? ZoneFromText(string? value)
        {
            var text = NormalizeSearchText(value);
            if (string.IsNullOrWhiteSpace(text) || text is "NO DISPONIBLE" or "UBICACION DESCONOCIDA")
            {
                return null;
            }

            foreach (var zone in CampusZones)
            {
                if (zone.Hints.Any(text.Contains))
                {
                    return zone.Label;
                }
            }

            return null;
        }

        private static string? ZoneFromCoordinates(double latitude, double longitude)
        {
            if (latitude == 0 && longitude == 0)
            {
                return null;
            }

            return CampusZones.FirstOrDefault(zone => IsPointInPolygon(latitude, longitude, zone.Points))?.Label;
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

        private static bool IsUnknownZone(string? value)
        {
            var text = NormalizeSearchText(value);
            return string.IsNullOrWhiteSpace(text) || text is "NO DISPONIBLE" or "UBICACION DESCONOCIDA";
        }

        private static string NormalizeSearchText(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var normalized = value.Trim().ToUpperInvariant().Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder(normalized.Length);
            foreach (var character in normalized)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
                {
                    builder.Append(character);
                }
            }

            return builder.ToString().Normalize(NormalizationForm.FormC);
        }
    }
}
