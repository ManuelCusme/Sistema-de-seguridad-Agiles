namespace UtaSecurity.Services.Incidents.Models
{
    public class PushTokenRegistrationDto
    {
        public string Token { get; set; } = string.Empty;
        public string? UserId { get; set; }
        public string? Platform { get; set; }
        public string? Role { get; set; }
    }
}
