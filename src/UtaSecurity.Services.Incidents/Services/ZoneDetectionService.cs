// ZONEDETECTIONSERVICE.CS — IMPLEMENTACIÓN DEL CLIENTE HTTP AL MS-C DE ZONAS
// Microservicio: UtaSecurity.Services.Incidents
// Responsable: Emilio Abril (EMILIOABRIL05)
// Sprint 2 — TA-06.4: Integrar detección de zona al flujo del MS de Incidentes
//
// Patrón: Fault-tolerant HTTP client — nunca bloquea el flujo principal.
// Si el MS-C de Manuel Cusme no responde (timeout 400ms), retorna "No disponible"
// y registra un warning en el log sin lanzar excepción al controlador.

using System.Net.Http.Json;

namespace UtaSecurity.Services.Incidents.Services
{
    /// <summary>
    /// Implementación concreta de IZoneDetectionService.
    /// Consulta al microservicio de Zonas (MS-C - Manuel Cusme) usando el
    /// IHttpClientFactory con el cliente nombrado "ZoneService" configurado en Program.cs.
    /// Política: tolerante a fallos — cualquier error retorna "No disponible".
    /// </summary>
    public class ZoneDetectionService : IZoneDetectionService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<ZoneDetectionService> _logger;

        public ZoneDetectionService(IHttpClientFactory httpClientFactory, ILogger<ZoneDetectionService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        /// <summary>
        /// Consulta GET /zonas/detectar?lat={lat}&lng={lng} en el MS-C de Zonas.
        /// Tiempo máximo de espera: 400ms (configurado en HttpClient por Program.cs).
        /// </summary>
        public async Task<string> DetectZoneAsync(double lat, double lng)
        {
            // Coordenadas (0,0) indican que no hay GPS disponible
            if (lat == 0 && lng == 0)
            {
                _logger.LogWarning("TA-06.4 | GPS no disponible (coordenadas en 0,0). Zona asignada: 'No disponible'.");
                return "No disponible";
            }

            try
            {
                var client = _httpClientFactory.CreateClient("ZoneService");
                // Endpoint del MS-C definido por Manuel Cusme: GET /zonas/detectar?lat=&lng=
                var response = await client.GetAsync($"/zonas/detectar?lat={lat}&lng={lng}");

                if (response.IsSuccessStatusCode)
                {
                    // El MS-C retorna un JSON con propiedad "zona" (string)
                    // Ejemplo: { "zona": "Ingeniería", "id": "Z1" }
                    var result = await response.Content.ReadFromJsonAsync<ZoneDetectionResponse>();
                    var zoneName = result?.Zona ?? "No disponible";
                    _logger.LogInformation("TA-06.4 | Zona detectada: '{Zona}' para coords ({Lat}, {Lng}).", zoneName, lat, lng);
                    return zoneName;
                }

                _logger.LogWarning("TA-06.4 | MS-C retornó HTTP {StatusCode} para ({Lat}, {Lng}). Zona: 'No disponible'.",
                    (int)response.StatusCode, lat, lng);
                return "No disponible";
            }
            catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException || ex.CancellationToken == default)
            {
                // Timeout del cliente HTTP (400ms configurado en Program.cs)
                _logger.LogWarning("TA-06.4 | Timeout al consultar MS-C de Zonas para ({Lat}, {Lng}). Zona: 'No disponible'.", lat, lng);
                return "No disponible";
            }
            catch (HttpRequestException ex)
            {
                // MS-C no disponible o error de red
                _logger.LogWarning(ex, "TA-06.4 | MS-C de Zonas no disponible para ({Lat}, {Lng}). Zona: 'No disponible'.", lat, lng);
                return "No disponible";
            }
            catch (Exception ex)
            {
                // Cualquier otro error no debe detener el flujo de la alerta
                _logger.LogWarning(ex, "TA-06.4 | Error inesperado al detectar zona para ({Lat}, {Lng}). Zona: 'No disponible'.", lat, lng);
                return "No disponible";
            }
        }

        /// <summary>
        /// Modelo auxiliar para deserializar la respuesta JSON del MS-C de Zonas.
        /// Compatible con el contrato de Manuel Cusme: { "zona": "Ingeniería" }
        /// </summary>
        private class ZoneDetectionResponse
        {
            public string? Zona { get; set; }
        }
    }
}
