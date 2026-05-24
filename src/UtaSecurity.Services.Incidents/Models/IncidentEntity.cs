using System;

namespace UtaSecurity.Services.Incidents.Models
{
    public class IncidentEntity
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; } // Referencia al usuario en Identity (GUID según Database.sql)
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string? GeofenceName { get; set; }
        // Zona detectada automáticamente desde MS-C de Zonas (Sprint 2 - TA-06.4)
        public string Zona { get; set; } = "No disponible";
        public string Motivo { get; set; } = "Emergencia";
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string Status { get; set; } = "PENDIENTE";
        public Guid? AssignedByUserId { get; set; }
        public DateTime? AssignedAt { get; set; }
        public Guid? ClosedByUserId { get; set; }
        public DateTime? ClosedAt { get; set; }
        public string? CloseObservation { get; set; }
    }
}
