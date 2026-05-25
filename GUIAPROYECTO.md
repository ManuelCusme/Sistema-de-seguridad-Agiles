# 🛡️ Sistema de Gestión de Incidentes de Seguridad — UTA
> **Carrera de Software · Ciclo Enero–Julio 2026**  
> Emilio Abril · Manuel Cusme · Mateo Herrera · Pablo Yupa

---

## 🎯 Objetivo
Reducir el tiempo de respuesta ante incidentes de seguridad en el campus de la UTA (robos, accidentes, acoso, arma blanca) mediante una red de comunicación en tiempo real entre estudiantes, guardias y personal administrativo.

---

## 🏗️ Arquitectura del Sistema

El sistema tiene **3 componentes** que trabajan sincronizados:

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| **Backend** | .NET 10 API + SignalR | Lógica de negocio, BD usuarios, geocercas, alertas en tiempo real |
| **App Móvil** | React Native + Expo | Botón de pánico (estudiantes) + mapa táctico (guardias) |
| **Panel Web** | React + Vite + Leaflet | Sala de guerra: mapa interactivo, gestión de incidentes |

### Flujo de una alerta
```
[Estudiante presiona 3s] → [GPS captura coords] → [POST al Backend]
        → [SignalR emite a todos los guardias conectados < 1 seg]
        → [Mapa web muestra el marcador en tiempo real]
```

---

## 🔑 Credenciales de Prueba (DITIC Simulada)

| Rol | Email | Contraseña |
|---|---|---|
| Admin | `admin@uta.edu.ec` | `admin123` |
| Estudiante 1–5 | `estudianteN@uta.edu.ec` | `123456` |
| Guardia 1–5 | `guardiaN@uta.edu.ec` | `123456` |

---

## 🚀 Guía de Inicio (Orden Obligatorio)

### ⚠️ Paso 0 — Configurar Red e IP
Tu PC y celular deben estar en la **misma red Wi-Fi**.

1. Obtén tu IP local en Windows:
```powershell
ipconfig
```
Usa la IPv4 (ejemplo: `192.168.0.5`).

2. Actualiza esa IP en la app móvil:
- `Frontend/context/AuthContext.js` → variable `API_URL`
- `Frontend/screens/GuardScreen.js` → método `signalR.withUrl(...)`

3. Para Expo LAN, usa también esa IP:
```powershell
set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.x.x
```

> Nota: El Panel Web Admin (`AdminWeb`) usa `window.location.hostname`, por lo que normalmente no requiere cambiar IP manualmente.

---

### Paso 1 — Restaurar dependencias del repositorio

Desde la raíz del proyecto:
```powershell
dotnet restore UtaSecurity.sln
```

Panel Web:
```powershell
cd AdminWeb
npm install
```

App móvil:
```powershell
cd ../Frontend
npm install
```

---

### Paso 2 — Levantar Backend (Opción A: Terminales)

Abre **4 terminales** en paralelo desde la raíz del repo:

Terminal 1 (Gateway):
```powershell
dotnet run --project src/UtaSecurity.Gateway/UtaSecurity.Gateway.csproj --urls "http://0.0.0.0:5000"
```

Terminal 2 (Identity):
```powershell
dotnet run --project src/UtaSecurity.Services.Identity/UtaSecurity.Services.Identity.csproj --urls "http://0.0.0.0:5001"
```

Terminal 3 (Incidents):
```powershell
dotnet run --project src/UtaSecurity.Services.Incidents/UtaSecurity.Services.Incidents.csproj --urls "http://0.0.0.0:5003"
```

Terminal 4 (Zones):
```powershell
dotnet run --project src/UtaSecurity.Services.Zones/UtaSecurity.Services.Zones.csproj --urls "http://0.0.0.0:5004"
```

Puertos esperados:
- Gateway: `5000`
- Identity: `5001`
- Incidents: `5003`
- Zones: `5004`

> Si solo quieres probar login del panel admin, el mínimo es: **Gateway (5000) + Identity (5001)**.

---

### Paso 2 (Alternativa) — Levantar Backend con UtaSecurity.sln (Visual Studio)

Sí, **sí se puede** levantar con `UtaSecurity.sln`.

1. Abre `UtaSecurity.sln` en Visual Studio 2022.
2. Clic derecho en la solución → **Set Startup Projects...**.
3. Selecciona **Multiple startup projects**.
4. Marca en **Start** estos proyectos:
        - `UtaSecurity.Gateway`
        - `UtaSecurity.Services.Identity`
        - `UtaSecurity.Services.Incidents`
        - `UtaSecurity.Services.Zones`
5. Ejecuta (F5 o Ctrl+F5).

Con esto, Visual Studio levanta todos los microservicios en paralelo usando sus `launchSettings.json`.

---

### Paso 3 — Levantar el Panel Web (Admin)

```powershell
cd AdminWeb
npm run dev
```

Acceso recomendado:
- `http://localhost:5173/login`

Credencial admin de prueba:
- Email: `admin@uta.edu.ec`
- Contraseña: `admin123`

---

### Paso 4 — Levantar la App Móvil

```powershell
cd Frontend
set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.x.x
npx expo start --lan
```

Escanear el QR con **Expo Go** en el celular.

---

## 📋 Planificación de Sprints

### 🟥 Sprint 1 · 27 Abril → 11 Mayo
**Meta:** Tener el cascarón de la arquitectura funcionando: Gateway, BD, botón de pánico y alerta llegando al panel web.

| Integrante | Tarea | Entregable esperado |
|---|---|---|
| **Emilio Abril** | API Gateway con Ocelot (.NET 10) + Hub SignalR | Gateway corriendo en `localhost:5000`, rutas `/api/users` e `/api/incidents` respondiendo. Hub SignalR en `/hubs/alerts` emitiendo eventos. |
| **Manuel Cusme** | Esquema SQL Server: tablas Usuarios, Roles, Zonas | Script `.sql` ejecutable por todo el equipo. 5 usuarios de prueba + 4 zonas del campus Huachi cargadas. |
| **Pablo Yupa** | App móvil: login + botón de pánico 3s + GPS | Botón dispara solo tras 3s de presión. Envía `POST` con userId, lat, lng y tipo de incidente al Gateway. |
| **Mateo Herrera** | Panel web: login + conexión SignalR + Toast de alerta | Dashboard muestra notificación visual en < 2s al recibir alerta del Hub. |

**✅ Logro del Sprint 1:** Flujo end-to-end funcional — el estudiante presiona el botón y el guardia/admin ve la alerta en el panel web en tiempo real.

---

### 🟧 Sprint 2 · 11 Mayo → 25 Mayo
**Meta:** Sistema geolocalizado con mapa del campus, flujo completo del guardia y notificaciones con datos completos.

| Integrante | Tarea | Entregable esperado |
|---|---|---|
| **Emilio Abril** | Integrar MS-B al flujo: detección de zona automática + cierre de caso en MS-C | Al recibir alerta, el sistema identifica la zona automáticamente. Al cerrar caso, todos los guardias reciben la actualización. |
| **Manuel Cusme** | Microservicio B: SQL Server con tipos `Geography` para polígonos de zonas | Endpoint `GET /zones/detect?lat=&lng=` retorna la zona correcta. 4 polígonos del campus insertados. |
| **Pablo Yupa** | App guardia: notificaciones SignalR + botón "Asumir caso" + formulario de cierre con observación | Guardia recibe alerta completa, puede asumir y cerrar con comentario obligatorio. |
| **Mateo Herrera** | Mapa Leaflet con polígonos de zonas + marcadores en tiempo real + panel lateral de alertas | Mapa muestra las 4 zonas coloreadas y marca el punto del incidente activo al recibirlo. |

**✅ Logro del Sprint 2:** El guardia sabe exactamente en qué zona ocurre el incidente, puede verlo en el mapa, asumir la responsabilidad y cerrar el caso con observación.

---

### 🟨 Sprint 3 · 25 Mayo → 08 Junio
**Meta:** Funcionalidades avanzadas, estadísticas y cierre del sistema completo.

| Integrante | Tarea | Entregable esperado |
|---|---|---|
| **Emilio Abril** | Módulo extra: registro de actividades/rondas del guardia (independiente de incidentes) | Guardia puede registrar rondas con título, hora y descripción sin necesidad de alerta activa. |
| **Manuel Cusme** | Grupos de confianza: crear grupos, notificar miembros al disparar alerta | Al activar pánico, la alerta llega a guardias + miembros del grupo de confianza del usuario. |
| **Pablo Yupa** | Switch "en servicio" del guardia: desactiva alertas fuera de turno | Guardia puede desactivar/activar recepción de alertas. Fuera de turno no recibe notificaciones. |
| **Mateo Herrera** | Dashboard de estadísticas: eventos por zona, tipo, fecha y guardia. CRUD de tipos de incidente. | Panel admin muestra gráficos de incidentes. Admin puede agregar/editar tipos (robo, desmayo, arma blanca, amenaza, otros). |

**✅ Logro del Sprint 3:** Sistema completo con grupos de confianza, estadísticas operativas, control de turnos y módulo extra de actividades del guardia.

---

## 🛡️ Características Clave del Sistema

- **Botón de pánico táctico** — 3 segundos de presión para evitar falsas alarmas, con barra de progreso visual.
- **Zonificación del campus** — 4 cuadrantes (Z1–Z4) para despliegue rápido de guardias, detectados automáticamente por GPS.
- **Identificación DITIC** — Solo usuarios institucionales acceden, identificando su facultad de origen.
- **Categorización de motivos** — Robo, arma blanca, desmayo, amenaza, otros. El guardia sabe a qué se enfrenta antes de llegar.
- **Sala de guerra (War Room)** — Panel web con diseño oscuro optimizado para centros de control.
- **Grupos de confianza** — Contactos del usuario que reciben la alerta además de los guardias.
- **Control de turno** — Guardias fuera de turno no reciben notificaciones.
