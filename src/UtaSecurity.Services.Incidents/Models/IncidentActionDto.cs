namespace UtaSecurity.Services.Incidents.Models
{
    public class IncidentActionDto
    {
        public string incId { get; set; } = string.Empty;
        public string usuId { get; set; } = string.Empty;
        public string? incObservacion { get; set; }
    }
}