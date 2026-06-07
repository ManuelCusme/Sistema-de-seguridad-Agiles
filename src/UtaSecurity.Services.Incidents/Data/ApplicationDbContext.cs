using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Incidents.Models;

namespace UtaSecurity.Services.Incidents.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        public DbSet<IncidentEntity> Incidents { get; set; }
        public DbSet<TrustGroupEntity> TrustGroups { get; set; }
        public DbSet<TrustGroupMemberEntity> TrustGroupMembers { get; set; }
        public DbSet<GuardRoundEntity> GuardRounds { get; set; }
        public DbSet<GuardDutyStatusEntity> GuardDutyStatuses { get; set; }
        public DbSet<IncidentTypeEntity> IncidentTypes { get; set; }
        public DbSet<UserDirectoryEntity> UserDirectory { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<IncidentEntity>(entity =>
            {
                entity.ToTable("Incidents");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("NEWID()");
                entity.Property(e => e.UserId).IsRequired();
                entity.Property(e => e.Latitude).IsRequired();
                entity.Property(e => e.Longitude).IsRequired();
                entity.Property(e => e.GeofenceName).HasMaxLength(100);
                entity.Property(e => e.Motivo).IsRequired().HasMaxLength(100).HasDefaultValue("Emergencia");
                entity.Property(e => e.Timestamp).IsRequired().HasDefaultValueSql("GETDATE()");
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20).HasDefaultValue("PENDIENTE");
                entity.Property(e => e.AssignedByUserId);
                entity.Property(e => e.AssignedAt);
                entity.Property(e => e.ClosedByUserId);
                entity.Property(e => e.ClosedAt);
                entity.Property(e => e.CloseObservation).HasMaxLength(500);
            });

            modelBuilder.Entity<TrustGroupEntity>(entity =>
            {
                entity.ToTable("TrustGroups");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("NEWID()");
                entity.Property(e => e.OwnerUserId).IsRequired();
                entity.Property(e => e.Name).IsRequired().HasMaxLength(120);
                entity.Property(e => e.CreatedAt).IsRequired().HasDefaultValueSql("GETDATE()");
                entity.Property(e => e.IsActive).IsRequired().HasDefaultValue(true);
                entity.HasMany(e => e.Members)
                    .WithOne(e => e.TrustGroup)
                    .HasForeignKey(e => e.TrustGroupId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<TrustGroupMemberEntity>(entity =>
            {
                entity.ToTable("TrustGroupMembers");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("NEWID()");
                entity.Property(e => e.TrustGroupId).IsRequired();
                entity.Property(e => e.MemberUserId).IsRequired();
                entity.Property(e => e.CreatedAt).IsRequired().HasDefaultValueSql("GETDATE()");
                entity.Property(e => e.IsActive).IsRequired().HasDefaultValue(true);
                entity.HasIndex(e => new { e.TrustGroupId, e.MemberUserId }).IsUnique();
            });

            modelBuilder.Entity<GuardRoundEntity>(entity =>
            {
                entity.ToTable("GuardRounds");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("NEWID()");
                entity.Property(e => e.GuardUserId).IsRequired();
                entity.Property(e => e.Zone).IsRequired().HasMaxLength(100);
                entity.Property(e => e.StartedAt).IsRequired().HasDefaultValueSql("GETDATE()");
                entity.Property(e => e.Observation).HasMaxLength(500);
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20).HasDefaultValue("EN_CURSO");
            });

            modelBuilder.Entity<GuardDutyStatusEntity>(entity =>
            {
                entity.ToTable("GuardDutyStatuses");
                entity.HasKey(e => e.GuardUserId);
                entity.Property(e => e.IsOnDuty).IsRequired().HasDefaultValue(true);
                entity.Property(e => e.UpdatedAt).IsRequired().HasDefaultValueSql("GETDATE()");
            });

            modelBuilder.Entity<IncidentTypeEntity>(entity =>
            {
                entity.ToTable("IncidentTypes");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("NEWID()");
                entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Code).IsRequired().HasMaxLength(60);
                entity.Property(e => e.Emoji).IsRequired().HasMaxLength(20);
                entity.Property(e => e.Color).IsRequired().HasMaxLength(20);
                entity.Property(e => e.IsActive).IsRequired().HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).IsRequired().HasDefaultValueSql("GETDATE()");
                entity.HasIndex(e => e.Code).IsUnique();
            });

            modelBuilder.Entity<UserDirectoryEntity>(entity =>
            {
                entity.ToTable("Users");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Nombre1).HasMaxLength(50);
                entity.Property(e => e.Nombre2).HasMaxLength(50);
                entity.Property(e => e.Apellido1).HasMaxLength(50);
                entity.Property(e => e.Apellido2).HasMaxLength(50);
                entity.Property(e => e.Email).HasMaxLength(100);
                entity.Property(e => e.Role).HasMaxLength(20);
            });
        }
    }
}
