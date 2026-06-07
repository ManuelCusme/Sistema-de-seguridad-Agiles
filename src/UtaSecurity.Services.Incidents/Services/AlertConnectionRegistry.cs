using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Incidents.Data;
using UtaSecurity.Services.Incidents.Hubs;

namespace UtaSecurity.Services.Incidents.Services
{
    public interface IAlertConnectionRegistry
    {
        Task RegisterAsync(HubCallerContext context, IGroupManager groups);
        Task UnregisterAsync(HubCallerContext context, IGroupManager groups);
        Task SetGuardDutyAsync(Guid guardUserId, bool isOnDuty, IHubContext<AlertHub> hubContext);
    }

    public class AlertConnectionRegistry : IAlertConnectionRegistry
    {
        public const string GuardsOnDutyGroup = "guards:on-duty";
        public const string AdminsGroup = "admins";
        public const string TrustUserGroupPrefix = "trust-user:";

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ConcurrentDictionary<string, ClientConnectionInfo> _connections = new();

        public AlertConnectionRegistry(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
        }

        public async Task RegisterAsync(HubCallerContext context, IGroupManager groups)
        {
            var userIdText = context.GetHttpContext()?.Request.Query["userId"].ToString();
            var role = context.GetHttpContext()?.Request.Query["role"].ToString() ?? string.Empty;
            var userId = Guid.TryParse(userIdText, out var parsedUserId) ? parsedUserId : (Guid?)null;
            var normalizedRole = role.Trim().ToUpperInvariant();

            var info = new ClientConnectionInfo(context.ConnectionId, userId, normalizedRole);
            _connections[context.ConnectionId] = info;

            if (userId.HasValue)
            {
                await groups.AddToGroupAsync(context.ConnectionId, $"{TrustUserGroupPrefix}{userId.Value}");
            }

            if (normalizedRole == "ADMIN")
            {
                await groups.AddToGroupAsync(context.ConnectionId, AdminsGroup);
            }

            if (normalizedRole == "GUARDIA" && userId.HasValue && await IsGuardOnDutyAsync(userId.Value))
            {
                await groups.AddToGroupAsync(context.ConnectionId, GuardsOnDutyGroup);
            }
        }

        public async Task UnregisterAsync(HubCallerContext context, IGroupManager groups)
        {
            if (!_connections.TryRemove(context.ConnectionId, out var info))
            {
                return;
            }

            if (info.UserId.HasValue)
            {
                await groups.RemoveFromGroupAsync(context.ConnectionId, $"{TrustUserGroupPrefix}{info.UserId.Value}");
            }

            await groups.RemoveFromGroupAsync(context.ConnectionId, AdminsGroup);
            await groups.RemoveFromGroupAsync(context.ConnectionId, GuardsOnDutyGroup);
        }

        public async Task SetGuardDutyAsync(Guid guardUserId, bool isOnDuty, IHubContext<AlertHub> hubContext)
        {
            var connections = _connections.Values
                .Where(item => item.UserId == guardUserId && item.Role == "GUARDIA")
                .ToList();

            foreach (var connection in connections)
            {
                if (isOnDuty)
                {
                    await hubContext.Groups.AddToGroupAsync(connection.ConnectionId, GuardsOnDutyGroup);
                }
                else
                {
                    await hubContext.Groups.RemoveFromGroupAsync(connection.ConnectionId, GuardsOnDutyGroup);
                }
            }
        }

        private async Task<bool> IsGuardOnDutyAsync(Guid guardUserId)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var status = await dbContext.GuardDutyStatuses.AsNoTracking().FirstOrDefaultAsync(item => item.GuardUserId == guardUserId);
            return status?.IsOnDuty ?? true;
        }

        private record ClientConnectionInfo(string ConnectionId, Guid? UserId, string Role);
    }
}
