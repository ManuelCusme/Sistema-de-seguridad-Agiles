using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Incidents.Data;
using UtaSecurity.Services.Incidents.Models;

namespace UtaSecurity.Services.Incidents.Controllers
{
    [ApiController]
    [Route("api/trust-groups")]
    public class TrustGroupsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public TrustGroupsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetGroups([FromQuery] string usuId)
        {
            if (!Guid.TryParse(usuId, out var ownerUserId))
            {
                return BadRequest(new { success = false, error = "Se requiere usuId valido." });
            }

            var groups = await _context.TrustGroups
                .AsNoTracking()
                .Include(item => item.Members.Where(member => member.IsActive))
                .Where(item => item.OwnerUserId == ownerUserId && item.IsActive)
                .OrderByDescending(item => item.CreatedAt)
                .ToListAsync();

            var memberIds = groups.SelectMany(item => item.Members).Select(item => item.MemberUserId).Distinct().ToList();
            var users = await _context.UserDirectory.AsNoTracking()
                .Where(item => memberIds.Contains(item.Id))
                .ToDictionaryAsync(item => item.Id, item => item);

            return Ok(groups.Select(group => new
            {
                id = group.Id,
                nombre = group.Name,
                creadoEn = group.CreatedAt,
                miembros = group.Members.Select(member =>
                {
                    users.TryGetValue(member.MemberUserId, out var user);
                    return new
                    {
                        id = member.Id,
                        usuId = member.MemberUserId,
                        nombre = user?.NombreCompleto ?? member.MemberUserId.ToString(),
                        email = user?.Email ?? string.Empty,
                        rol = user?.Role ?? string.Empty
                    };
                })
            }));
        }

        [HttpPost]
        public async Task<IActionResult> CreateGroup([FromBody] TrustGroupCreateDto request)
        {
            if (!Guid.TryParse(request?.usuId, out var ownerUserId))
            {
                return BadRequest(new { success = false, error = "Se requiere usuId valido." });
            }

            var name = request?.nombre?.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return BadRequest(new { success = false, error = "El nombre del grupo es obligatorio." });
            }

            var group = new TrustGroupEntity
            {
                OwnerUserId = ownerUserId,
                Name = name,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.TrustGroups.Add(group);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, id = group.Id, nombre = group.Name });
        }

        [HttpPost("{groupId:guid}/members")]
        public async Task<IActionResult> AddMember(Guid groupId, [FromBody] TrustGroupMemberDto request)
        {
            if (!Guid.TryParse(request?.usuId, out var ownerUserId))
            {
                return BadRequest(new { success = false, error = "Se requiere usuId valido." });
            }

            var group = await _context.TrustGroups.FirstOrDefaultAsync(item => item.Id == groupId && item.OwnerUserId == ownerUserId && item.IsActive);
            if (group == null)
            {
                return NotFound(new { success = false, error = "No se encontro el grupo solicitado." });
            }

            var memberUserId = await ResolveMemberUserIdAsync(request);
            if (!memberUserId.HasValue)
            {
                return NotFound(new { success = false, error = "No se encontro un usuario activo con ese correo o ID." });
            }

            if (memberUserId.Value == ownerUserId)
            {
                return BadRequest(new { success = false, error = "No puedes agregarte como miembro de tu propio grupo." });
            }

            var existing = await _context.TrustGroupMembers.FirstOrDefaultAsync(item => item.TrustGroupId == groupId && item.MemberUserId == memberUserId.Value);
            if (existing != null)
            {
                existing.IsActive = true;
            }
            else
            {
                _context.TrustGroupMembers.Add(new TrustGroupMemberEntity
                {
                    TrustGroupId = groupId,
                    MemberUserId = memberUserId.Value,
                    CreatedAt = DateTime.UtcNow,
                    IsActive = true
                });
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, memberUserId = memberUserId.Value });
        }

        [HttpDelete("{groupId:guid}/members/{memberId:guid}")]
        public async Task<IActionResult> RemoveMember(Guid groupId, Guid memberId, [FromQuery] string usuId)
        {
            if (!Guid.TryParse(usuId, out var ownerUserId))
            {
                return BadRequest(new { success = false, error = "Se requiere usuId valido." });
            }

            var ownsGroup = await _context.TrustGroups.AnyAsync(item => item.Id == groupId && item.OwnerUserId == ownerUserId && item.IsActive);
            if (!ownsGroup)
            {
                return NotFound(new { success = false, error = "No se encontro el grupo solicitado." });
            }

            var member = await _context.TrustGroupMembers.FirstOrDefaultAsync(item => item.Id == memberId && item.TrustGroupId == groupId);
            if (member == null)
            {
                return NotFound(new { success = false, error = "No se encontro el miembro solicitado." });
            }

            member.IsActive = false;
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("{groupId:guid}")]
        public async Task<IActionResult> DeleteGroup(Guid groupId, [FromQuery] string usuId)
        {
            if (!Guid.TryParse(usuId, out var ownerUserId))
            {
                return BadRequest(new { success = false, error = "Se requiere usuId valido." });
            }

            var group = await _context.TrustGroups.Include(item => item.Members).FirstOrDefaultAsync(item => item.Id == groupId && item.OwnerUserId == ownerUserId);
            if (group == null)
            {
                return NotFound(new { success = false, error = "No se encontro el grupo solicitado." });
            }

            group.IsActive = false;
            foreach (var member in group.Members)
            {
                member.IsActive = false;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        private async Task<Guid?> ResolveMemberUserIdAsync(TrustGroupMemberDto? request)
        {
            if (Guid.TryParse(request?.memberUserId, out var parsedUserId))
            {
                var exists = await _context.UserDirectory.AnyAsync(item => item.Id == parsedUserId && item.IsActive);
                return exists ? parsedUserId : null;
            }

            var email = request?.memberEmail?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email))
            {
                return null;
            }

            var user = await _context.UserDirectory.AsNoTracking().FirstOrDefaultAsync(item => item.Email.ToLower() == email && item.IsActive);
            return user?.Id;
        }
    }
}
