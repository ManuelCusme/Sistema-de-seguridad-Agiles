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
        public DbSet<GeofenceEntity> Geofences { get; set; }

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

            modelBuilder.Entity<GeofenceEntity>(entity =>
            {
                entity.ToTable("Geofences");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("NEWID()");
                entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Latitude).IsRequired();
                entity.Property(e => e.Longitude).IsRequired();
                entity.Property(e => e.Radius).IsRequired();
            });
        }
    }
}
