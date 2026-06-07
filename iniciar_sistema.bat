@echo off
setlocal EnableExtensions

title UTA Security - iniciar sistema
cd /d "%~dp0"

set "SQL_SERVER=.\SQLEXPRESS"
set "DB_SCRIPT=%~dp0Database.sql"
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
echo [5/6] Abriendo backend en ventanas separadas...
start "UTA Gateway :5000" /D "%~dp0" cmd /k dotnet run --project src\UtaSecurity.Gateway\UtaSecurity.Gateway.csproj --urls http://0.0.0.0:5000
start "UTA Identity :5001" /D "%~dp0" cmd /k dotnet run --project src\UtaSecurity.Services.Identity\UtaSecurity.Services.Identity.csproj --urls http://0.0.0.0:5001
start "UTA Incidents :5003" /D "%~dp0" cmd /k dotnet run --project src\UtaSecurity.Services.Incidents\UtaSecurity.Services.Incidents.csproj --urls http://0.0.0.0:5003
start "UTA Zones :5004" /D "%~dp0" cmd /k dotnet run --project src\UtaSecurity.Services.Zones\UtaSecurity.Services.Zones.csproj --urls http://0.0.0.0:5004

echo Esperando unos segundos para que arranque Identity y complete el seed de usuarios BCrypt...
timeout /t 12 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://localhost:5001/api/identity/users' -TimeoutSec 5 | Out-Null; Write-Host '[OK] Seed de usuarios verificado.' } catch { Write-Host '[ADVERTENCIA] No se pudo verificar Identity todavia. Puede seguir arrancando en su ventana.' }"

echo.
echo [6/6] Abriendo frontends...
start "UTA AdminWeb :5173" /D "%~dp0AdminWeb" cmd /k npm run dev -- --host 0.0.0.0
start "UTA App Movil Expo - QR" /D "%~dp0Frontend" cmd /k "echo ============================================================ && echo  QR DE EXPO: escanea esta ventana con Expo Go && echo  Asegurate de que el celular y la PC esten en la misma red Wi-Fi && echo  IP usada por Expo: %LOCAL_IP% && echo ============================================================ && set REACT_NATIVE_PACKAGER_HOSTNAME=%LOCAL_IP%&& set EXPO_PUBLIC_API_HOST=%LOCAL_IP%&& set NODE_OPTIONS=--max-old-space-size=4096&& npx expo start --lan --clear"

timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo ============================================================
echo  Sistema iniciado.
echo.
echo  Panel web:      http://localhost:5173
echo  QR Expo:        ventana "UTA App Movil Expo - QR"
echo  API Gateway:    http://localhost:5000
echo  Identity:       http://localhost:5001
echo  Incidents:      http://localhost:5003
echo  Zones:          http://localhost:5004
echo.
echo  Usuarios de prueba:
echo    admin@uta.edu.ec / admin123
echo    estudiante1@uta.edu.ec ... estudiante5@uta.edu.ec / 123456
echo    guardia1@uta.edu.ec ... guardia5@uta.edu.ec / 123456
echo.
echo  Para ver la app movil, escanea el QR que aparece en la ventana de Expo.
echo ============================================================
echo.
pause
