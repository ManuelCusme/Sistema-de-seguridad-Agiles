# 🚀 Reingeniería Backend UTA - Sprint 1 (Emilio Abril - EMILIOABRIL05)

## 📌 Tickets Vinculados
| Ticket | Tarea |
|---|---|
| **[SCRUM-1]** | Setup del API Gateway con Ocelot |
| **[SCRUM-4]** | Hub SignalR y Microservicio de Incidentes |

---

## 📝 Resumen de Cambios

Este PR implementa el **Sprint 1 del backend de reingeniería** del Sistema de Seguridad UTA, migrando la arquitectura monolítica del prototipo (`SeguridadUta.Api`) a una solución distribuida de microservicios bajo **.NET 10 + Ocelot + SignalR**.

### Tarea A — API Gateway (`UtaSecurity.Gateway`)
- **[NUEVO]** `src/UtaSecurity.Gateway/Program.cs` — Gateway con CORS global para React Web, React Native y emuladores Android.
- **[NUEVO]** `src/UtaSecurity.Gateway/ocelot.json` — Enruta HTTP hacia MS-A (Puerto 5001) y MS-C (Puerto 5003). Enruta WebSockets hacia `/hubs/alerts`.
- **[NUEVO]** Endpoint `GET /health` que retorna `{ status, timestamp, service }` con timestamp en formato ISO 8601.

### Tarea B — Microservicio Incidentes (`UtaSecurity.Services.Incidents`)
- **[NUEVO]** `src/UtaSecurity.Services.Incidents/Models/IncidentDto.cs` — Modelo tipado con nomenclatura del equipo (prefijo `inc` + CamelCase).
- **[NUEVO]** `src/UtaSecurity.Services.Incidents/Hubs/AlertHub.cs` — Hub SignalR con método `BroadcastAlert(IncidentDto)` (tipado fuerte, mejora del prototipo original que usaba parámetros posicionales).
- **[NUEVO]** `src/UtaSecurity.Services.Incidents/Controllers/IncidentsController.cs` — `POST /api/incidents` que recibe la alerta, la procesa y la emite por SignalR.
- **[NUEVO]** `src/UtaSecurity.Services.Incidents/Program.cs` — Startup del microservicio con SignalR + CORS.

---

## ✅ Verificación Local — Pruebas para Revisores

### Paso 1: Iniciar los Servicios

Abrir **DOS terminales PowerShell** en el directorio raíz `d:\SistemaSeguridad\`:

```powershell
# Terminal 1 — Microservicio de Incidentes (Puerto 5003)
dotnet run --project src/UtaSecurity.Services.Incidents --urls "http://localhost:5003"

# Terminal 2 — API Gateway (Puerto 5000)
dotnet run --project src/UtaSecurity.Gateway --urls "http://localhost:5000"
```

### Paso 2: Verificar HealthCheck del Gateway

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/health" -Method GET | ConvertTo-Json
```

**Respuesta esperada:**
```json
{
  "status": "Healthy",
  "timestamp": "2026-05-07T20:35:57.001Z",
  "service": "Gateway"
}
```

### Paso 3: Simular Alerta de Pánico (Flujo Completo End-to-End)

```powershell
$body = '{
  "incMotivo": "Robo",
  "incLatitud": -1.2692,
  "incLongitud": -78.6242,
  "incGeocercaNombre": "Campus Huachi",
  "incReportadoPor": "Emilio Abril",
  "incFacultad": "FISEI",
  "incSeveridad": "Alto"
}'

Invoke-RestMethod -Uri "http://localhost:5000/api/incidents" -Method POST -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 5
```

**Respuesta esperada (HTTP 200 OK):**
```json
{
  "mensaje": "Alerta de incidente registrada y transmitida exitosamente.",
  "data": {
    "incId": "9a343090-8041-414b-940f-379bad73499e",
    "incMotivo": "Robo",
    "incLatitud": -1.2692,
    "incLongitud": -78.6242,
    "incGeocercaNombre": "Campus Huachi",
    "incReportadoPor": "Emilio Abril",
    "incFacultad": "FISEI",
    "incSeveridad": "Alto",
    "incFechaReporte": "2026-05-07T20:36:40.843Z"
  }
}
```

---

## 👥 Revisores Requeridos
- @ManuelCusme (Líder Técnico — revisión de arquitectura)
- @Mateo
- @Pablo

---

## 🔗 Commits Incluidos
```
778356f [SCRUM-1] fix: corregir pipeline del gateway para que health check responda antes que ocelot
f8da2a5 [SCRUM-4] feat: implementacion ms-c incidentes con alerthub signalr y dto tipado
ec2898d [SCRUM-1] feat: implementacion api gateway con ocelot, healthcheck y cors global para react y react native
```
