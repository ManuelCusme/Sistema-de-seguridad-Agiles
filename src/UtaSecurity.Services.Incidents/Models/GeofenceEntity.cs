using System;

namespace UtaSecurity.Services.Incidents.Models
{
    public class GeofenceEntity
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public double Radius { get; set; } // meters
    }
}
