// IZONEDETECTIONSERVICE.CS — INTERFAZ DEL SERVICIO DE DETECCIÓN DE ZONA
// Microservicio: UtaSecurity.Services.Incidents
// Responsable: Emilio Abril (EMILIOABRIL05)
// Abstracción para facilitar el testing con mocks y desacoplar la implementación HTTP.

namespace UtaSecurity.Services.Incidents.Services
{
    /// <summary>
    /// Contrato para consultar al MS-C de Zonas (Manuel Cusme) la zona que
    /// corresponde a unas coordenadas GPS. Diseñado para ser tolerante a fallos:
    /// si el MS-C no responde, retorna "No disponible" sin interrumpir el flujo.
    /// </summary>
    public interface IZoneDetectionService
    {
        /// <summary>
        /// Consulta el endpoint GET /zonas/detectar?lat={lat}&lng={lng} del MS-C.
        /// </summary>
        /// <param name="lat">Latitud del incidente</param>
        /// <param name="lng">Longitud del incidente</param>
        /// <returns>Nombre de la zona (ej: "Ingeniería") o "No disponible" si falla</returns>
        Task<string> DetectZoneAsync(double lat, double lng);
    }
}
