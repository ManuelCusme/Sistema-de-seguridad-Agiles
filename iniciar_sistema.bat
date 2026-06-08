@echo off
setlocal EnableExtensions

title UTA Security - iniciar sistema
cd /d "%~dp0"

set "SQL_SERVER=.\SQLEXPRESS"
set "DB_SCRIPT=%~dp0Database.sql"
set "ADMIN_PORT=5173"
set "EXPO_PORT=8081"
set "LOCAL_IP="

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ip = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address.IPAddress -notlike '169.254*' } | Sort-Object InterfaceMetric | Select-Object -First 1 -ExpandProperty IPv4Address; if ($ip) { $ip.IPAddress }"`) do set "LOCAL_IP=%%I"
if "%LOCAL_IP%"=="" for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254*' } | Sort-Object InterfaceMetric | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "LOCAL_IP=%%I"
if "%LOCAL_IP%"=="" set "LOCAL_IP=localhost"

echo ============================================================
echo  Sistema de Seguridad UTA
echo  Inicializando dependencias, base de datos y servicios
echo  IP detectada para QR Expo: %LOCAL_IP%
echo ============================================================
echo.

where dotnet >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No se encontro dotnet en el PATH. Instala el SDK de .NET requerido.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No se encontro npm en el PATH. Instala Node.js 20 o superior.
    pause
    exit /b 1
)

echo Cerrando instancias anteriores de este sistema para evitar DLL bloqueados...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = (Resolve-Path '%~dp0').Path.TrimEnd('\'); Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and (($_.CommandLine -like ('*' + $root + '*UtaSecurity*')) -or ($_.CommandLine -like ('*' + $root + '*AdminWeb*')) -or ($_.CommandLine -like ('*' + $root + '*Frontend*')) -or ($_.CommandLine -like '*dotnet run --project src\UtaSecurity*') -or ($_.Name -like 'UtaSecurity.*.exe')) } | Where-Object { $_.ProcessId -ne $PID } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; Write-Host ('Cerrado PID ' + $_.ProcessId + ' - ' + $_.Name) } catch { Write-Host ('No se pudo cerrar PID ' + $_.ProcessId) } }"
timeout /t 2 /nobreak >nul

echo [1/6] Restaurando paquetes .NET...
dotnet restore "%~dp0UtaSecurity.sln"
if errorlevel 1 (
    echo [ERROR] Fallo dotnet restore.
    pause
    exit /b 1
)

echo.
echo [2/6] Verificando dependencias del panel web...
pushd "%~dp0AdminWeb"
call npm install --prefer-offline
if errorlevel 1 (
    popd
    echo [ERROR] Fallo npm install en AdminWeb.
    pause
    exit /b 1
)
popd

echo.
echo [3/6] Verificando dependencias de la app movil...
pushd "%~dp0Frontend"
call npm install --prefer-offline
if errorlevel 1 (
    popd
    echo [ERROR] Fallo npm install en Frontend.
    pause
    exit /b 1
)
call npx expo install --check
if errorlevel 1 (
    popd
    echo [ERROR] Las dependencias de Expo no estan alineadas con el SDK instalado.
    echo Ejecuta: cd Frontend && npx expo install
    pause
    exit /b 1
)
popd

echo.
echo [4/6] Sembrando base de datos de prueba en %SQL_SERVER%...
where sqlcmd >nul 2>nul
if errorlevel 1 (
    echo [ADVERTENCIA] No se encontro sqlcmd en el PATH.
    echo Ejecuta manualmente "%DB_SCRIPT%" en SQL Server Management Studio si la base aun no existe.
) else (
    sqlcmd -S "%SQL_SERVER%" -E -C -i "%DB_SCRIPT%"
    if errorlevel 1 (
        echo [ERROR] Fallo la ejecucion de Database.sql en %SQL_SERVER%.
        echo Revisa que SQL Server Express este activo o cambia SQL_SERVER en este archivo.
        pause
        exit /b 1
    )
)

echo.
echo Verificando que los puertos principales esten libres...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$frontendPorts = @(%ADMIN_PORT%,%EXPO_PORT%); foreach ($port in $frontendPorts) { Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -and $_ -ne $PID } | ForEach-Object { try { Stop-Process -Id $_ -Force -ErrorAction Stop; Write-Host ('Cerrado proceso que ocupaba puerto ' + $port + ' PID ' + $_) } catch {} } }"
timeout /t 2 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(5000,5001,5003,5004,%ADMIN_PORT%,%EXPO_PORT%); $busy = foreach ($port in $ports) { Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object { $port } }; if ($busy) { Write-Host ('[ERROR] Puertos aun ocupados: ' + (($busy | Sort-Object -Unique) -join ', ')); Write-Host 'Cierra las ventanas anteriores del sistema y vuelve a ejecutar este archivo.'; exit 1 } else { Write-Host '[OK] Puertos principales libres.' }"
if errorlevel 1 (
    pause
    exit /b 1
)

echo.
echo [5/6] Abriendo backend en ventanas separadas...
start "UTA Gateway :5000" /D "%~dp0" cmd /k dotnet run --project src\UtaSecurity.Gateway\UtaSecurity.Gateway.csproj --urls http://0.0.0.0:5000
start "UTA Identity :5001" /D "%~dp0" cmd /k dotnet run --project src\UtaSecurity.Services.Identity\UtaSecurity.Services.Identity.csproj --urls http://0.0.0.0:5001
start "UTA Incidents :5003" /D "%~dp0" cmd /k dotnet run --project src\UtaSecurity.Services.Incidents\UtaSecurity.Services.Incidents.csproj --urls http://0.0.0.0:5003
start "UTA Zones :5004" /D "%~dp0" cmd /k dotnet run --project src\UtaSecurity.Services.Zones\UtaSecurity.Services.Zones.csproj --urls http://0.0.0.0:5004

echo Esperando servicios backend y seed de usuarios BCrypt...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$checks = @(@{Name='Gateway'; Url='http://localhost:5000/health'}, @{Name='Identity'; Url='http://localhost:5001/api/identity/users'}, @{Name='Incidents'; Url='http://localhost:5003/api/incidents'}, @{Name='Zones'; Url='http://localhost:5004/zonas/detectar?lat=0&lng=0'}); foreach ($check in $checks) { $ok = $false; for ($i = 1; $i -le 24 -and -not $ok; $i++) { try { Invoke-RestMethod -Uri $check.Url -TimeoutSec 3 | Out-Null; $ok = $true } catch { Start-Sleep -Seconds 2 } }; if ($ok) { Write-Host ('[OK] ' + $check.Name + ' listo.') } else { Write-Host ('[ADVERTENCIA] ' + $check.Name + ' no respondio todavia. Revisa su ventana.') } }"

echo.
echo [6/6] Abriendo frontends...
start "UTA AdminWeb :%ADMIN_PORT%" /D "%~dp0AdminWeb" cmd /k npm run dev -- --host 0.0.0.0 --port %ADMIN_PORT% --strictPort
start "UTA App Movil Expo Go - QR" /D "%~dp0Frontend" cmd /k "echo ============================================================ && echo  QR DE EXPO GO: escanea esta ventana con Expo Go && echo  Asegurate de que el celular y la PC esten en la misma red Wi-Fi && echo  IP/API usada por la app: %LOCAL_IP% && echo  Si necesitas push remoto real, usa development build/EAS. && echo ============================================================ && set REACT_NATIVE_PACKAGER_HOSTNAME=%LOCAL_IP%&& set EXPO_PUBLIC_API_HOST=%LOCAL_IP%&& set NODE_OPTIONS=--max-old-space-size=4096&& npx expo start --go --lan --clear --port %EXPO_PORT%"

timeout /t 4 /nobreak >nul
start "" "http://localhost:%ADMIN_PORT%"

echo.
echo ============================================================
echo  Sistema iniciado.
echo.
echo  Panel web:      http://localhost:%ADMIN_PORT%
echo  Panel en red:   http://%LOCAL_IP%:%ADMIN_PORT%
echo  QR Expo:        ventana "UTA App Movil Expo - QR"
echo  API Gateway:    http://localhost:5000
echo  API en red:     http://%LOCAL_IP%:5000
echo  Identity:       http://localhost:5001
echo  Incidents:      http://localhost:5003
echo  Zones:          http://localhost:5004
echo.
echo  Usuarios de prueba:
echo    admin@uta.edu.ec / admin123
echo    estudiante1@uta.edu.ec ... estudiante5@uta.edu.ec / 123456
echo    guardia1@uta.edu.ec ... guardia5@uta.edu.ec / 123456
echo.
echo  Flujo rapido de prueba:
echo    1. Entra al panel web con admin@uta.edu.ec / admin123.
echo    2. Escanea el QR de Expo desde el celular en la misma Wi-Fi.
echo    3. Entra como estudiante para reportar alertas.
echo    4. Entra como guardia para marcar turno, recibir y asumir incidentes.
echo    5. Crea un tipo de incidente en AdminWeb y revisa que aparezca sin relogin.
echo.
echo  Nota: Expo Go no soporta push remoto real en SDK moderno.
echo        En demo, SignalR muestra notificaciones locales con la app abierta.
echo ============================================================
echo.
pause
