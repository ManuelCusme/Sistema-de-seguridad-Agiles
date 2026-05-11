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
            });
        }
    }
}
