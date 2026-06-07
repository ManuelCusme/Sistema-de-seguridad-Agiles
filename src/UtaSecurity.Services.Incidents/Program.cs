// PROGRAM.CS — UTASECURITY.SERVICES.INCIDENTS (Puerto 5003)
// Desarrollado bajo .NET 10.0 - Microservicios con Clean Architecture
// Responsable: Emilio Abril (EMILIOABRIL05)
// Este servicio gestiona SOLO incidentes y SignalR. No tiene autenticación ni base de datos.
// Eso corresponde a MS-A (Identity) y será integrado en sprints futuros.

using UtaSecurity.Services.Incidents.Hubs;
using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Incidents.Data;
using UtaSecurity.Services.Incidents.Services;

var builder = WebApplication.CreateBuilder(args);

// --- REGISTRAR CONTROLADORES ---
builder.Services.AddControllers();

// --- REGISTRAR CONTEXTO DE BASE DE DATOS ---
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// --- ACTIVAR SIGNALR PARA NOTIFICACIONES EN TIEMPO REAL ---
builder.Services.AddSignalR();
builder.Services.AddSingleton<IAlertConnectionRegistry, AlertConnectionRegistry>();

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

builder.Services.AddHttpClient("ExpoPush", client =>
{
    client.BaseAddress = new Uri("https://exp.host");
    client.Timeout = TimeSpan.FromSeconds(5);
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

        IF OBJECT_ID('dbo.TrustGroups', 'U') IS NULL
        BEGIN
            CREATE TABLE TrustGroups (
                Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                OwnerUserId UNIQUEIDENTIFIER NOT NULL,
                Name NVARCHAR(120) NOT NULL,
                CreatedAt DATETIME NOT NULL CONSTRAINT DF_TrustGroups_CreatedAt DEFAULT GETDATE(),
                IsActive BIT NOT NULL CONSTRAINT DF_TrustGroups_IsActive DEFAULT 1
            );
        END;

        IF OBJECT_ID('dbo.TrustGroupMembers', 'U') IS NULL
        BEGIN
            CREATE TABLE TrustGroupMembers (
                Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                TrustGroupId UNIQUEIDENTIFIER NOT NULL,
                MemberUserId UNIQUEIDENTIFIER NOT NULL,
                CreatedAt DATETIME NOT NULL CONSTRAINT DF_TrustGroupMembers_CreatedAt DEFAULT GETDATE(),
                IsActive BIT NOT NULL CONSTRAINT DF_TrustGroupMembers_IsActive DEFAULT 1,
                CONSTRAINT FK_TrustGroupMembers_TrustGroups FOREIGN KEY (TrustGroupId) REFERENCES TrustGroups(Id)
            );
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TrustGroupMembers_Group_User' AND object_id = OBJECT_ID('dbo.TrustGroupMembers'))
        BEGIN
            CREATE UNIQUE INDEX UX_TrustGroupMembers_Group_User ON TrustGroupMembers(TrustGroupId, MemberUserId);
        END;

        IF OBJECT_ID('dbo.GuardRounds', 'U') IS NULL
        BEGIN
            CREATE TABLE GuardRounds (
                Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                GuardUserId UNIQUEIDENTIFIER NOT NULL,
                Zone NVARCHAR(100) NOT NULL,
                StartedAt DATETIME NOT NULL CONSTRAINT DF_GuardRounds_StartedAt DEFAULT GETDATE(),
                EndedAt DATETIME NULL,
                Observation NVARCHAR(500) NULL,
                DurationMinutes INT NULL,
                Status NVARCHAR(20) NOT NULL CONSTRAINT DF_GuardRounds_Status DEFAULT 'EN_CURSO'
            );
        END;

        IF OBJECT_ID('dbo.GuardDutyStatuses', 'U') IS NULL
        BEGIN
            CREATE TABLE GuardDutyStatuses (
                GuardUserId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                IsOnDuty BIT NOT NULL CONSTRAINT DF_GuardDutyStatuses_IsOnDuty DEFAULT 1,
                UpdatedAt DATETIME NOT NULL CONSTRAINT DF_GuardDutyStatuses_UpdatedAt DEFAULT GETDATE()
            );
        END;

        IF OBJECT_ID('dbo.IncidentTypes', 'U') IS NULL
        BEGIN
            CREATE TABLE IncidentTypes (
                Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                Name NVARCHAR(100) NOT NULL,
                Code NVARCHAR(60) NOT NULL,
                Emoji NVARCHAR(20) NOT NULL,
                Color NVARCHAR(20) NOT NULL,
                IsActive BIT NOT NULL CONSTRAINT DF_IncidentTypes_IsActive DEFAULT 1,
                CreatedAt DATETIME NOT NULL CONSTRAINT DF_IncidentTypes_CreatedAt DEFAULT GETDATE(),
                UpdatedAt DATETIME NULL
            );
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_IncidentTypes_Code' AND object_id = OBJECT_ID('dbo.IncidentTypes'))
        BEGIN
            CREATE UNIQUE INDEX UX_IncidentTypes_Code ON IncidentTypes(Code);
        END;

        MERGE IncidentTypes AS target
        USING (VALUES
            ('Robo/Asalto', 'ROBO_ASALTO', NCHAR(0xD83D) + NCHAR(0xDCB0), '#ff4fa3'),
            ('Arma blanca', 'ARMA_BLANCA', NCHAR(0xD83D) + NCHAR(0xDEE1), '#ef4444'),
            ('Desmayo/Emergencia medica', 'DESMAYO_EMERGENCIA_MEDICA', NCHAR(0x2764), '#8f65ff'),
            ('Amenaza', 'AMENAZA', NCHAR(0x26A0), '#f7c948'),
            ('Otros', 'OTROS', NCHAR(0xD83D) + NCHAR(0xDEA8), '#4d82ff')
        ) AS source (Name, Code, Emoji, Color)
        ON target.Code = source.Code
        WHEN NOT MATCHED THEN
            INSERT (Id, Name, Code, Emoji, Color, IsActive, CreatedAt)
            VALUES (NEWID(), source.Name, source.Code, source.Emoji, source.Color, 1, GETDATE());
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
