// ALERTHUB.CS — HUB DE SIGNALR PARA ALERTAS EN TIEMPO REAL
// Microservicio: UtaSecurity.Services.Incidents
// Responsable: Emilio Abril (EMILIOABRIL05)
// Mejora respecto al prototipo: usa DTO tipado en lugar de parámetros posicionales

using Microsoft.AspNetCore.SignalR;
using UtaSecurity.Services.Incidents.Models;

namespace UtaSecurity.Services.Incidents.Hubs
{
    /// <summary>
    /// Gestiona las conexiones WebSocket para transmisión de alertas en tiempo real.
    /// Los clientes (React Web y React Native) deben suscribirse al evento 'ReceiveAlert'.
    /// Ruta del Hub: /hubs/alerts (registrada en Program.cs y en ocelot.json del Gateway)
    /// </summary>
    public class AlertHub : Hub
    {
        /// <summary>
        /// Difunde una alerta de incidente a TODOS los clientes conectados al Hub.
        /// Destinatarios: Panel de Guardias (GuardScreen.js), Mapa Administrativo (AdminWeb).
        /// </summary>
        /// <param name="objIncidente">Objeto tipado con todos los datos del incidente.</param>
        public async Task BroadcastAlert(IncidentDto objIncidente)
        {
            // Emitir el evento al cliente con el nombre 'ReceiveAlert'
            // El frontend React Native y React Web escuchan este evento por nombre
            await Clients.All.SendAsync("ReceiveAlert", objIncidente);
        }

        /// <summary>
        /// Recibe la ubicación actual de un guardia y la difunde al panel administrativo.
        /// </summary>
        public async Task UpdateGuardLocation(GuardLocationDto location)
        {
            if (location == null)
            {
                return;
            }

            location.UpdatedAt = DateTime.UtcNow;
            await Clients.All.SendAsync("ReceiveGuardLocation", location);
        }

        /// <summary>
        /// Evento que se ejecuta cuando un cliente (Guardia/Admin) se conecta al Hub.
        /// </summary>
        public override async Task OnConnectedAsync()
        {
            // En sprints futuros: registrar la conexión y notificar al admin
            await base.OnConnectedAsync();
        }

        /// <summary>
        /// Evento que se ejecuta cuando un cliente se desconecta del Hub.
        /// </summary>
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            // En sprints futuros: actualizar el estado de disponibilidad del guardia
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
