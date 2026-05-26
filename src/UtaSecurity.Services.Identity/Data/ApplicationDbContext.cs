using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Identity.Models;

namespace UtaSecurity.Services.Identity.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        public DbSet<UserEntity> Users { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            // Configuración de la tabla Users según Database.sql
            modelBuilder.Entity<UserEntity>(entity =>
            {
                entity.ToTable("Users");
                entity.HasKey(e => e.usuId);
                
                // Mapeo manual si los nombres en SQL no coinciden con los del modelo
                // Pero como estamos haciendo ingeniería inversa, vamos a mapearlos exactamente
                entity.Property(e => e.usuId).HasColumnName("Id");
                entity.Property(e => e.usuNombre1).HasColumnName("Nombre1").IsRequired();
                entity.Property(e => e.usuNombre2).HasColumnName("Nombre2");
                entity.Property(e => e.usuApellido1).HasColumnName("Apellido1").IsRequired();
                entity.Property(e => e.usuApellido2).HasColumnName("Apellido2");
                entity.Property(e => e.usuEmail).HasColumnName("Email").IsRequired();
                entity.Property(e => e.usuPasswordHash).HasColumnName("PasswordHash").IsRequired();
                entity.Property(e => e.usuBirthDate).HasColumnName("BirthDate").IsRequired();
                entity.Property(e => e.usuRole).HasColumnName("Role").IsRequired();
                entity.Property(e => e.usuFacultad).HasColumnName("Facultad").IsRequired();
                entity.Property(e => e.usuIsActive).HasColumnName("IsActive").IsRequired();
                entity.Property(e => e.usuCreatedAt).HasColumnName("CreatedAt").IsRequired();
            });
        }
    }
}
