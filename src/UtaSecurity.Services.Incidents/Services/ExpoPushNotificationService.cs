using System.Collections.Concurrent;
using System.Net.Http.Json;
using UtaSecurity.Services.Incidents.Models;

namespace UtaSecurity.Services.Incidents.Services
{
    public static class ExpoPushNotificationService
    {
        private static readonly ConcurrentDictionary<string, PushTokenRegistrationDto> Tokens = new();

        public static int TokenCount => Tokens.Count;

        public static void Register(PushTokenRegistrationDto registration)
        {
            Tokens.AddOrUpdate(registration.Token, registration, (_, _) => registration);
        }

        public static async Task NotifyIncidentAsync(IHttpClientFactory httpClientFactory, IncidentDto incident, ILogger logger)
        {
            if (Tokens.IsEmpty)
            {
                return;
            }

            try
            {
                var messages = Tokens.Values.Select(token => new
                {
                    to = token.Token,
                    title = "Nueva incidencia UTA",
                    body = $"{incident.incMotivo} - {incident.incZona}",
                    sound = "default",
                    priority = "high",
                    channelId = "incidents",
                    data = new
                    {
                        incidenteId = incident.incId,
                        zona = incident.incZona,
                        tipo = incident.incMotivo,
                        timestamp = incident.incFechaReporte
                    }
                }).ToArray();

                var client = httpClientFactory.CreateClient("ExpoPush");
                var response = await client.PostAsJsonAsync("/--/api/v2/push/send", messages);

                if (!response.IsSuccessStatusCode)
                {
                    logger.LogWarning("Expo Push devolvio estado {StatusCode}", response.StatusCode);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning("No se pudo enviar push de incidencia: {Message}", ex.Message);
            }
        }
    }
}
