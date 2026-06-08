using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
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

        [HttpGet("member-of")]
        public async Task<IActionResult> GetGroupsAsMember([FromQuery] string usuId)
        {
            if (!Guid.TryParse(usuId, out var memberUserId))
            {
                return BadRequest(new { success = false, error = "Se requiere usuId valido." });
            }

            var memberGroups = await _context.TrustGroupMembers
                .AsNoTracking()
                .Include(m => m.TrustGroup)
                .Where(m => m.MemberUserId == memberUserId && m.IsActive && m.TrustGroup != null && m.TrustGroup.IsActive)
                .OrderByDescending(m => m.CreatedAt)
                .ToListAsync();

            var ownerIds = memberGroups.Select(m => m.TrustGroup!.OwnerUserId).Distinct().ToList();
            var owners = await _context.UserDirectory.AsNoTracking()
                .Where(u => ownerIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u);

            return Ok(memberGroups.Select(m => {
                owners.TryGetValue(m.TrustGroup!.OwnerUserId, out var owner);
                return new
                {
                    id = m.TrustGroup.Id,
                    nombre = m.TrustGroup.Name,
                    propietario = owner?.NombreCompleto ?? m.TrustGroup.OwnerUserId.ToString(),
                    propietarioEmail = owner?.Email ?? string.Empty
                };
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

            if (name.Length > 120)
            {
                return BadRequest(new { success = false, error = "El nombre del grupo no puede superar los 120 caracteres." });
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

            var isAlreadyMember = await _context.TrustGroupMembers.AnyAsync(item => item.TrustGroupId == groupId && item.MemberUserId == memberUserId.Value && item.IsActive);
            if (isAlreadyMember)
            {
                return BadRequest(new { success = false, error = "El usuario ya es miembro de este grupo." });
            }

            await AddOrReactivateMemberAsync(groupId, memberUserId.Value);
            await _context.SaveChangesAsync();
            return Ok(new { success = true, memberUserId = memberUserId.Value });
        }

        [HttpPost("{groupId:guid}/invites")]
        public async Task<IActionResult> CreateInvite(Guid groupId, [FromBody] TrustGroupInviteCreateDto request)
        {
            if (!Guid.TryParse(request?.usuId, out var ownerUserId))
            {
                return BadRequest(new { success = false, error = "Se requiere usuId valido." });
            }

            var group = await _context.TrustGroups.AsNoTracking().FirstOrDefaultAsync(item => item.Id == groupId && item.OwnerUserId == ownerUserId && item.IsActive);
            if (group == null)
            {
                return NotFound(new { success = false, error = "No se encontro el grupo solicitado." });
            }

            var expiresInMinutes = Math.Clamp(request?.expiresInMinutes ?? 15, 5, 60);
            var invite = new TrustGroupInviteEntity
            {
                TrustGroupId = groupId,
                CreatedByUserId = ownerUserId,
                Token = GenerateInviteToken(),
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddMinutes(expiresInMinutes),
                IsActive = true
            };

            _context.TrustGroupInvites.Add(invite);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                token = invite.Token,
                inviteUrl = $"utasecurity://trust-groups/join?token={invite.Token}",
                grupoId = group.Id,
                grupoNombre = group.Name,
                expiraEn = invite.ExpiresAt
            });
        }

        [HttpPost("invites/accept")]
        public async Task<IActionResult> AcceptInvite([FromBody] TrustGroupInviteAcceptDto request)
        {
            if (!Guid.TryParse(request?.usuId, out var memberUserId))
            {
                return BadRequest(new { success = false, error = "Se requiere usuId valido." });
            }

            var token = ExtractInviteToken(request?.token);
            if (string.IsNullOrWhiteSpace(token))
            {
                return BadRequest(new { success = false, error = "El codigo QR no contiene una invitacion valida." });
            }

            var invite = await _context.TrustGroupInvites
                .Include(item => item.TrustGroup)
                .FirstOrDefaultAsync(item => item.Token == token && item.IsActive);

            if (invite == null || invite.TrustGroup == null || !invite.TrustGroup.IsActive)
            {
                return NotFound(new { success = false, error = "La invitacion no existe o ya no esta disponible." });
            }

            if (invite.ExpiresAt < DateTime.UtcNow)
            {
                invite.IsActive = false;
                await _context.SaveChangesAsync();
                return BadRequest(new { success = false, error = "La invitacion expiro. Solicita un QR nuevo." });
            }

            if (invite.TrustGroup.OwnerUserId == memberUserId)
            {
                return BadRequest(new { success = false, error = "No puedes unirte a tu propio grupo." });
            }

            var isAlreadyMember = await _context.TrustGroupMembers.AnyAsync(item => item.TrustGroupId == invite.TrustGroupId && item.MemberUserId == memberUserId && item.IsActive);
            if (isAlreadyMember)
            {
                return BadRequest(new { success = false, error = "Ya eres miembro de este grupo de confianza." });
            }

            var userExists = await _context.UserDirectory.AnyAsync(item => item.Id == memberUserId && item.IsActive);
            if (!userExists)
            {
                return NotFound(new { success = false, error = "No se encontro un usuario activo para unir al grupo." });
            }

            await AddOrReactivateMemberAsync(invite.TrustGroupId, memberUserId);
            invite.UsedAt = DateTime.UtcNow;
            invite.UsedByUserId = memberUserId;
            invite.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                grupoId = invite.TrustGroup.Id,
                grupoNombre = invite.TrustGroup.Name,
                memberUserId
            });
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

        private async Task AddOrReactivateMemberAsync(Guid groupId, Guid memberUserId)
        {
            var existing = await _context.TrustGroupMembers.FirstOrDefaultAsync(item => item.TrustGroupId == groupId && item.MemberUserId == memberUserId);
            if (existing != null)
            {
                existing.IsActive = true;
                return;
            }

            _context.TrustGroupMembers.Add(new TrustGroupMemberEntity
            {
                TrustGroupId = groupId,
                MemberUserId = memberUserId,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            });
        }

        private static string GenerateInviteToken()
        {
            return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                .Replace("+", "-")
                .Replace("/", "_")
                .TrimEnd('=');
        }

        private static string ExtractInviteToken(string? rawValue)
        {
            var value = rawValue?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            if (Uri.TryCreate(value, UriKind.Absolute, out var uri))
            {
                var query = uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries);
                foreach (var part in query)
                {
                    var pieces = part.Split('=', 2);
                    if (pieces.Length == 2 && string.Equals(pieces[0], "token", StringComparison.OrdinalIgnoreCase))
                    {
                        return Uri.UnescapeDataString(pieces[1]);
                    }
                }
            }

            return value;
        }
    }
}
