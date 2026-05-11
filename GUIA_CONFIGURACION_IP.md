# 🌐 Guía de Configuración de Conectividad (IP) — UTA Security

Para que el sistema funcione correctamente entre distintos dispositivos (Celular, PC del Admin, Servidor), es crucial que todos apunten a la misma dirección IP local del PC que hace de servidor.

---

### 1. Identificar tu IP Local
Abre una terminal en Windows (`cmd` o `PowerShell`) y escribe:
```bash
ipconfig
```
Busca la línea que dice **IPv4 Address**.  
*Ejemplo: `192.168.0.5`*

---

### 2. Dónde cambiar la IP en el Código

Si tu IP cambia (ej: te conectas a otra red Wi-Fi), debes actualizarla en estos **3 lugares obligatorios**:

#### A. Aplicación Móvil (Login y Registro)
**Archivo:** `Frontend/context/AuthContext.js`  
**Línea 11:**
```javascript
const API_URL = 'http://TU_IP_AQUI:5000/api';
```

#### B. Aplicación Móvil (Mapa de Guardias)
**Archivo:** `Frontend/screens/GuardScreen.js`  
**Línea 70:**
```javascript
.withUrl("http://TU_IP_AQUI:5000/hubs/alerts")
```

#### C. Aplicación Móvil (Arranque de Expo)
Al iniciar la app desde la terminal, usa tu IP para que el QR sea escaneable:
```powershell
set REACT_NATIVE_PACKAGER_HOSTNAME=TU_IP_AQUI
npx expo start --lan
```

---

### 3. Notas Importantes
- **Gateway y Microservicios:** Ya están configurados para escuchar en `0.0.0.0`, lo que significa que aceptan conexiones de cualquier IP automáticamente. No necesitas cambiar nada en los archivos `.cs`.
- **Panel Web (Admin):** Se configura automáticamente al cargar en el navegador usando `window.location.hostname`. No requiere cambios manuales.
- **Firewall:** Asegúrate de que el Firewall de Windows permita tráfico en los puertos `5000`, `5001` y `5003`.

---

> **Responsable:** Manuel Cusme  
> **Última actualización:** 11 Mayo 2026 (Sprint 1 Finalizado)
