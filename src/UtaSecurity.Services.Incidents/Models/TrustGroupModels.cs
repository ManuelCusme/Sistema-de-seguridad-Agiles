using System.ComponentModel.DataAnnotations.Schema;

namespace UtaSecurity.Services.Incidents.Models
{
    public class TrustGroupEntity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid OwnerUserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;
        public List<TrustGroupMemberEntity> Members { get; set; } = new();
    }

    public class TrustGroupMemberEntity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid TrustGroupId { get; set; }
        public Guid MemberUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;
        public TrustGroupEntity? TrustGroup { get; set; }
    }

    public class TrustGroupInviteEntity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid TrustGroupId { get; set; }
        public Guid CreatedByUserId { get; set; }
        public string Token { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }
        public DateTime? UsedAt { get; set; }
        public Guid? UsedByUserId { get; set; }
        public bool IsActive { get; set; } = true;
        public TrustGroupEntity? TrustGroup { get; set; }
    }

    public class TrustGroupCreateDto
    {
        public string usuId { get; set; } = string.Empty;
        public string nombre { get; set; } = string.Empty;
    }

    public class TrustGroupMemberDto
    {
        public string usuId { get; set; } = string.Empty;
        public string memberUserId { get; set; } = string.Empty;
        public string memberEmail { get; set; } = string.Empty;
    }

    public class TrustGroupInviteCreateDto
    {
        public string usuId { get; set; } = string.Empty;
        public int expiresInMinutes { get; set; } = 15;
    }

    public class TrustGroupInviteAcceptDto
    {
        public string usuId { get; set; } = string.Empty;
        public string token { get; set; } = string.Empty;
    }

    // Lectura liviana de Users para resolver miembros por correo sin duplicar la lógica de Identity.
    public class UserDirectoryEntity
    {
        public Guid Id { get; set; }
        public string Nombre1 { get; set; } = string.Empty;
        public string? Nombre2 { get; set; }
        public string Apellido1 { get; set; } = string.Empty;
        public string? Apellido2 { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;

        [NotMapped]
        public string NombreCompleto => string.Join(" ", new[] { Nombre1, Nombre2, Apellido1, Apellido2 }.Where(item => !string.IsNullOrWhiteSpace(item)));
    }
}
