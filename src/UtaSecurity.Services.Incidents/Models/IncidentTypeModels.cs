namespace UtaSecurity.Services.Incidents.Models
{
    public class IncidentTypeEntity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Emoji { get; set; } = "\U0001F6A8";
        public string Color { get; set; } = "#4d82ff";
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }

    public class IncidentTypeUpsertDto
    {
        public string nombre { get; set; } = string.Empty;
        public string codigo { get; set; } = string.Empty;
        public string emoji { get; set; } = "\U0001F6A8";
        public string color { get; set; } = "#4d82ff";
    }
}
