// PROGRAM.CS — UTASECURITY.SERVICES.INCIDENTS (Puerto 5003)
// Desarrollado bajo .NET 10.0 - Microservicios con Clean Architecture
// Responsable: Emilio Abril (EMILIOABRIL05)
// Este servicio gestiona SOLO incidentes y SignalR. No tiene autenticación ni base de datos.
// Eso corresponde a MS-A (Identity) y será integrado en sprints futuros.

using UtaSecurity.Services.Incidents.Hubs;
using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Incidents.Data;

var builder = WebApplication.CreateBuilder(args);

// --- REGISTRAR CONTROLADORES ---
builder.Services.AddControllers();

// --- REGISTRAR CONTEXTO DE BASE DE DATOS ---
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// --- ACTIVAR SIGNALR PARA NOTIFICACIONES EN TIEMPO REAL ---
builder.Services.AddSignalR();

// --- POLÍTICA DE CORS PARA EL MICROSERVICIO ---
// Acepta peticiones directas en desarrollo desde el Gateway, React y Metro Bundler
builder.Services.AddCors(options =>
{
    options.AddPolicy("ServiceCorsPolicy", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5000",    // Peticiones enrutadas por el API Gateway
                "http://localhost:5173",    // Panel Web React (Vite) en desarrollo directo
                "http://localhost:8081"     // React Native Metro Bundler
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();            // Requerido para el handshake inicial de WebSockets
    });
});

var app = builder.Build();

// --- APLICAR MIDDLEWARES EN ORDEN CORRECTO ---
app.UseCors("ServiceCorsPolicy");       // CORS debe ir antes de UseRouting
app.UseRouting();
app.UseAuthorization();

// --- MAPEAR ENDPOINTS ---
// Controladores REST para recibir alertas HTTP
app.MapControllers();

// Hub WebSocket de alertas SignalR
// IMPORTANTE: La ruta '/hubs/alerts' debe coincidir exactamente con el ocelot.json del Gateway
app.MapHub<AlertHub>("/hubs/alerts");

app.Run();
