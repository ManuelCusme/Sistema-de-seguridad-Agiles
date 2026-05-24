// INCIDENTDTO.CS — MODELO DE TRANSFERENCIA DE DATOS
// Microservicio: UtaSecurity.Services.Incidents
// Responsable: Emilio Abril (EMILIOABRIL05)
// Convención del equipo: prefijo 'inc' + CamelCase en todos los atributos

namespace UtaSecurity.Services.Incidents.Models
{
    /// <summary>
    /// Modelo tipado para transferir y emitir datos de incidentes de seguridad en tiempo real.
    /// Reemplaza el PanicDto del prototipo que no tenía tipado fuerte ni nomenclatura estándar.
    /// </summary>
    public class IncidentDto
    {
        // incId: Identificador único asignado por el servidor (no confiar en ID del cliente)
        public string incId { get; set; } = Guid.NewGuid().ToString();

        // incMotivo: Causa de la emergencia (Robo, Acoso, Incendio, Accidente, Médico)
        public string incMotivo { get; set; } = "Emergencia";

        // incLatitud: Coordenada geográfica - latitud donde ocurrió el incidente
        public double incLatitud { get; set; }

        // incLongitud: Coordenada geográfica - longitud donde ocurrió el incidente
        public double incLongitud { get; set; }

        // incGeocercaNombre: Zona táctica del Campus UTA detectada (ej: "Campus Huachi")
        public string incGeocercaNombre { get; set; } = "Ubicación desconocida";

        // incReportadoPor: Nombre completo del estudiante o guardia que emite la alerta
        public string incReportadoPor { get; set; } = string.Empty;

        // incUsuarioId: Identificador del usuario autenticado que reporta la emergencia
        public string incUsuarioId { get; set; } = string.Empty;

        // incFacultad: Facultad del reportante (ej: FISEI, FCHE, FCIAL)
        public string incFacultad { get; set; } = "FISEI";

        // incSeveridad: Nivel de criticidad de la alerta (Bajo, Medio, Alto, Crítico)
        public string incSeveridad { get; set; } = "Medio";

        // incZona: Zona detectada usando el GPS y el MS-C de Zonas
        public string incZona { get; set; } = "No disponible";

        // incFechaReporte: Marca de tiempo UTC del servidor al procesar la alerta
        public DateTime incFechaReporte { get; set; } = DateTime.UtcNow;
    }
}
