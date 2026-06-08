using Microsoft.AspNetCore.SignalR;
using UtaSecurity.Services.Incidents.Models;
using UtaSecurity.Services.Incidents.Services;

namespace UtaSecurity.Services.Incidents.Hubs
{
    public class AlertHub : Hub
    {
        private readonly IAlertConnectionRegistry _connectionRegistry;

        public AlertHub(IAlertConnectionRegistry connectionRegistry)
        {
            _connectionRegistry = connectionRegistry;
        }

        public async Task BroadcastAlert(IncidentDto objIncidente)
        {
            // HU-12: solo los guardias en servicio y los administradores reciben nuevas alertas.
            await Clients.Groups(AlertConnectionRegistry.GuardsOnDutyGroup, AlertConnectionRegistry.AdminsGroup)
                .SendAsync("ReceiveAlert", objIncidente);
        }

        public async Task UpdateGuardLocation(GuardLocationDto location)
        {
            if (location == null)
            {
                return;
            }

            location.UpdatedAt = DateTime.UtcNow;
            await Clients.All.SendAsync("ReceiveGuardLocation", location);
        }

        public override async Task OnConnectedAsync()
        {
            // El cliente envia userId/role en el handshake para asignarlo a grupos SignalR.
            await _connectionRegistry.RegisterAsync(Context, Groups);
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await _connectionRegistry.UnregisterAsync(Context, Groups);
            await base.OnDisconnectedAsync(exception);
        }
    }

    public class GuardLocationDto
    {
        public string GuardId { get; set; } = string.Empty;
        public string GuardName { get; set; } = "Guardia";
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string? IncidentId { get; set; }
        public string? IncidentStatus { get; set; }
        public string? IncidentMotivo { get; set; }
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
