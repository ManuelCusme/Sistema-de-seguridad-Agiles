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
        public string Motivo { get; set; } = "Emergencia";
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
