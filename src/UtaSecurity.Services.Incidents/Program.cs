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

// --- REGISTRAR CLIENTE HTTP PARA MS-C DE ZONAS (TA-06.4) ---
// El cliente "ZoneService" consume GET /zonas/detectar?lat=&lng= del microservicio de Manuel
// La URL base es configurable por entorno para no hardcodear IPs
builder.Services.AddHttpClient("ZoneService", client =>
{
    var baseUrl = builder.Configuration["ZoneServiceBaseUrl"] ?? "http://localhost:5004";
    client.BaseAddress = new Uri(baseUrl);
    // Timeout estricto: el flujo de alerta NO puede bloquearse más de 400ms esperando la zona
    client.Timeout = TimeSpan.FromMilliseconds(400);
});

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

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await dbContext.Database.ExecuteSqlRawAsync(@"
        IF COL_LENGTH('dbo.Incidents', 'Status') IS NULL
        BEGIN
            ALTER TABLE Incidents ADD Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Incidents_Status DEFAULT 'PENDIENTE';
        END;

        IF COL_LENGTH('dbo.Incidents', 'AssignedByUserId') IS NULL
        BEGIN
            ALTER TABLE Incidents ADD AssignedByUserId UNIQUEIDENTIFIER NULL;
        END;

        IF COL_LENGTH('dbo.Incidents', 'AssignedAt') IS NULL
        BEGIN
            ALTER TABLE Incidents ADD AssignedAt DATETIME NULL;
        END;

        IF COL_LENGTH('dbo.Incidents', 'ClosedByUserId') IS NULL
        BEGIN
            ALTER TABLE Incidents ADD ClosedByUserId UNIQUEIDENTIFIER NULL;
        END;

        IF COL_LENGTH('dbo.Incidents', 'ClosedAt') IS NULL
        BEGIN
            ALTER TABLE Incidents ADD ClosedAt DATETIME NULL;
        END;

        IF COL_LENGTH('dbo.Incidents', 'CloseObservation') IS NULL
        BEGIN
            ALTER TABLE Incidents ADD CloseObservation NVARCHAR(500) NULL;
        END;

        IF COL_LENGTH('dbo.Incidents', 'Zona') IS NULL
        BEGIN
            ALTER TABLE Incidents ADD Zona NVARCHAR(100) NOT NULL CONSTRAINT DF_Incidents_Zona DEFAULT 'No disponible';
        END;
    ");
}

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
