# Sistema de Seguridad UTA

Sistema de gestión de incidentes de seguridad para el campus de la UTA. Está compuesto por una API Gateway en .NET, tres microservicios, un panel web para guardias y administración, y una app móvil para estudiantes y guardias.

## Descripción

El objetivo del sistema es reducir el tiempo de respuesta ante incidentes dentro del campus mediante alertas en tiempo real, geolocalización de zonas, autenticación institucional y seguimiento operativo de cada caso.

### Arquitectura

| Componente | Ruta | Tecnología | Puerto |
|---|---|---|---|
| API Gateway | `src/UtaSecurity.Gateway` | .NET 10 + Ocelot | `5000` |
| Identidad | `src/UtaSecurity.Services.Identity` | .NET 10 + EF Core + JWT | `5001` |
| Incidentes | `src/UtaSecurity.Services.Incidents` | .NET 10 + SignalR + EF Core | `5003` |
| Zonas | `src/UtaSecurity.Services.Zones` | .NET 10 + SQL Server | `5004` |
| Panel web | `AdminWeb` | React + Vite + Leaflet | `5173` |
| App móvil | `Frontend` | Expo + React Native | variable |

## Capturas y mockups

Captura de referencia del panel web:

![Panel web](AdminWeb/src/assets/hero.png)

Mockups disponibles en el repositorio:

- [Mockup del panel guardia](Frontend/guard-mockup.html)
- [Mockup móvil de estudiante](Frontend/student-mockup.html)
- [Guía visual del panel web](AdminWeb/mockup/index.html)

## Requisitos previos

- .NET 10 SDK.
- Node.js 20 o superior.
- SQL Server Express o una instancia de SQL Server accesible.
- Expo CLI o `npx expo` para la app móvil.
- Misma red Wi-Fi si vas a probar la app móvil desde un dispositivo físico.

## Instalación

1. Clona el repositorio y abre la carpeta raíz.
2. Restaura las dependencias de .NET:

```powershell
dotnet restore UtaSecurity.sln
```

3. Instala dependencias del panel web:

```powershell
cd AdminWeb
npm install
```

4. Instala dependencias de la app móvil:

```powershell
cd ..\Frontend
npm install
```

5. Ejecuta el script de base de datos `Database.sql` en SQL Server para crear la base `SeguridadUtaDB` y sus tablas iniciales.

## Ejecución

### Backend

Levanta estos servicios en terminales separadas desde la raíz del proyecto:

```powershell
dotnet run --project src/UtaSecurity.Gateway/UtaSecurity.Gateway.csproj --urls "http://0.0.0.0:5000"
dotnet run --project src/UtaSecurity.Services.Identity/UtaSecurity.Services.Identity.csproj --urls "http://0.0.0.0:5001"
dotnet run --project src/UtaSecurity.Services.Incidents/UtaSecurity.Services.Incidents.csproj --urls "http://0.0.0.0:5003"
dotnet run --project src/UtaSecurity.Services.Zones/UtaSecurity.Services.Zones.csproj --urls "http://0.0.0.0:5004"
```

Si solo vas a probar el panel web, basta con `Gateway` e `Identity`.

### Panel web

```powershell
cd AdminWeb
npm run dev
```

Abre `http://localhost:5173`.

### App móvil

Antes de iniciar Expo, revisa la IP local usada por la app en `Frontend/context/AuthContext.js` y en `Frontend/screens/GuardScreen.js`, o sigue la guía [GUIA_CONFIGURACION_IP.md](GUIA_CONFIGURACION_IP.md).

```powershell
cd Frontend
set REACT_NATIVE_PACKAGER_HOSTNAME=TU_IP_LOCAL
npx expo start --lan
```

## Uso básico

### Acceso administrativo

- Email: `admin@uta.edu.ec`
- Contraseña: `admin123`

### Acceso de prueba para estudiantes y guardias

- Estudiantes: `estudiante1@uta.edu.ec` a `estudiante5@uta.edu.ec`
- Guardias: `guardia1@uta.edu.ec` a `guardia5@uta.edu.ec`
- Contraseña: `123456`

### Endpoints útiles

- `GET http://localhost:5000/health` para verificar el gateway.
- `POST http://localhost:5000/api/identity/login` para autenticación.
- `GET http://localhost:5000/api/identity/users` para listar usuarios.
- `GET http://localhost:5000/api/incidents` para ver incidentes.
- `POST http://localhost:5000/api/incidents` para registrar una alerta.
- `GET http://localhost:5000/api/zones/...` para consultar zonas.

### Ejemplo de login

```json
{
  "usuEmail": "admin@uta.edu.ec",
  "usuPassword": "admin123"
}
```

### Ejemplo de uso

1. Inicia el backend.
2. Abre el panel web o la app móvil.
3. Inicia sesión con un usuario de prueba.
4. Envía una alerta desde la app móvil.
5. Verifica cómo aparece en el mapa y en la lista de incidentes del panel web.

## Estructura general

- `src/` contiene los microservicios y el gateway.
- `AdminWeb/` contiene el panel web para administración y guardias.
- `Frontend/` contiene la app móvil en Expo.
- `Database.sql` crea la base de datos y los datos iniciales.
- `GUIAPROYECTO.md` contiene la guía funcional y la planificación del proyecto.

## Documentación adicional

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [LICENSE](LICENSE)
- [GUIA_CONFIGURACION_IP.md](GUIA_CONFIGURACION_IP.md)

## Verificación rápida

En el panel web, confirma lo siguiente después de hacer cambios:

- El mapa carga polígonos y marcadores.
- El botón de recentrar devuelve la vista al campus.
- La lista de alertas actualiza el mapa al seleccionar un incidente.
- El gráfico de estadísticas muestra la tendencia horaria.
