// PROGRAM.CS — UTASECURITY.SERVICES.IDENTITY (Puerto 5001)
// Desarrollado bajo .NET 10.0 - Microservicios con Clean Architecture
// Responsable: Emilio Abril (EMILIOABRIL05)
// Este servicio gestiona SOLO el registro, login y tokens JWT de los usuarios.

using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Identity.Data;

var builder = WebApplication.CreateBuilder(args);

// --- REGISTRAR CONTROLADORES ---
builder.Services.AddControllers();

// --- REGISTRAR CONTEXTO DE BASE DE DATOS ---
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// --- POLÍTICA DE CORS PARA EL MICROSERVICIO ---
// Habilita peticiones desde el Gateway, React Web y Metro Bundler para móvil
builder.Services.AddCors(options =>
{
    options.AddPolicy("IdentityServiceCorsPolicy", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5000",    // API Gateway
                "http://localhost:5173",    // Panel Web React (Vite)
                "http://localhost:8081"     // React Native Metro Bundler
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();            // Requerido si se transmiten credenciales
    });
});

var app = builder.Build();

// --- APLICAR MIDDLEWARES ---
app.UseCors("IdentityServiceCorsPolicy");
app.UseRouting();
app.UseAuthorization();

// --- MAPEAR CONTROLADORES ---
app.MapControllers();

app.Run();
