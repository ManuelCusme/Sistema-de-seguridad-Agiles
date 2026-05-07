// PROGRAM.CS — UTASECURITY.GATEWAY
// Desarrollado bajo .NET 10.0 - Microservicios con Clean Architecture
// Responsable: Emilio Abril (EMILIOABRIL05)
// Propósito: API Gateway centralizado para enrutar tráfico HTTP y WebSockets

using Ocelot.DependencyInjection;
using Ocelot.Middleware;

var builder = WebApplication.CreateBuilder(args);

// --- POLÍTICA DE CORS GLOBAL ---
// Permite React Web (Vite), React Native (Metro Bundler) y emuladores Android
// Corrección respecto al prototipo original que solo incluía localhost:5173
builder.Services.AddCors(options =>
{
    options.AddPolicy("GlobalCorsPolicy", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",    // Panel Web React (Vite)
                "http://localhost:8081",    // React Native Metro Bundler
                "http://10.0.2.2:8081"     // Emulador Android (IP especial del host)
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();            // Obligatorio para el handshake de WebSockets SignalR
    });
});

// --- CARGAR CONFIGURACIÓN DE ENRUTAMIENTO OCELOT ---
builder.Configuration.AddJsonFile("ocelot.json", optional: false, reloadOnChange: true);

// --- REGISTRAR SERVICIOS DE OCELOT ---
builder.Services.AddOcelot(builder.Configuration);

var app = builder.Build();

// --- APLICAR CORS ANTES DE OCELOT ---
app.UseCors("GlobalCorsPolicy");

// --- ENDPOINT DE SALUD (HEALTH CHECK) ---
// IMPORTANTE: Debe registrarse con UseRouting + UseEndpoints ANTES de UseOcelot
// Ocelot es un middleware terminal y capturaría la ruta /health si no se hace así
app.UseRouting();

app.UseEndpoints(endpoints =>
{
    // Endpoint GET /health — retorna JSON estándar del equipo
    endpoints.MapGet("/health", () => Results.Json(new
    {
        status = "Healthy",
        timestamp = DateTime.UtcNow.ToString("o"),  // Formato ISO 8601
        service = "Gateway"
    }));
});

// --- ACTIVAR MIDDLEWARE OCELOT ---
// Intercepta todas las rutas restantes y las enruta según ocelot.json
await app.UseOcelot();

app.Run();
