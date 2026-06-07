namespace UtaSecurity.Services.Incidents.Models
{
    public class GuardRoundEntity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid GuardUserId { get; set; }
        public string Zone { get; set; } = string.Empty;
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;
        public DateTime? EndedAt { get; set; }
        public string? Observation { get; set; }
        public int? DurationMinutes { get; set; }
        public string Status { get; set; } = "EN_CURSO";
    }

    public class GuardRoundStartDto
    {
        public string usuId { get; set; } = string.Empty;
        public string zona { get; set; } = string.Empty;
    }

    public class GuardRoundFinishDto
    {
        public string rondaId { get; set; } = string.Empty;
        public string usuId { get; set; } = string.Empty;
        public string observacion { get; set; } = string.Empty;
    }

    public class GuardDutyStatusEntity
    {
        public Guid GuardUserId { get; set; }
        public bool IsOnDuty { get; set; } = true;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class GuardDutyStatusDto
    {
        public string usuId { get; set; } = string.Empty;
        public bool enServicio { get; set; }
    }
}
