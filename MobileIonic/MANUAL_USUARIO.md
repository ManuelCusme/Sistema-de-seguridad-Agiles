# Manual de usuario - Seguridad UTA Mobile

## 1. Descripcion general

Seguridad UTA Mobile es la aplicacion Android para estudiantes y guardias del sistema de seguridad institucional. La app esta construida con Ionic React y se conecta al gateway C# del proyecto por HTTP.

Funciones principales:

- Inicio de sesion con usuarios institucionales.
- Registro de estudiantes.
- Envio de alertas con ubicacion GPS.
- Historial de incidentes del estudiante.
- Grupos de confianza con invitacion por QR/token.
- Panel de guardia para ver, aceptar y cerrar incidentes.
- Rondas de vigilancia.
- Detalle de incidente con coordenadas y enlace a Google Maps.

## 2. Instalacion del APK

APK generado:

```text
D:\SistemaSeguridad\MobileIonic\android\app\build\outputs\apk\debug\app-debug.apk
```

Pasos:

1. Copiar o abrir el APK en un celular Android.
2. Permitir instalacion desde origen desconocido si Android lo solicita.
3. Instalar la aplicacion "Seguridad UTA".
4. Abrir la app y aceptar permisos de ubicacion cuando se vaya a enviar una alerta.

## 3. Configuracion del servidor

La app debe apuntar al gateway C# del sistema.

Valor por defecto en este APK:

```text
http://10.79.25.95:5000
```

Si la IP de la computadora cambia:

1. Abrir la app.
2. Entrar en "Configurar servidor".
3. Escribir la URL base del gateway, por ejemplo:

```text
http://192.168.1.20:5000
```

4. Guardar.
5. Volver al login.

Nota: en Android no se debe usar `localhost`, porque `localhost` apunta al propio celular, no a la computadora donde corre el backend.

## 4. Notificaciones en APK

La app solicita permiso de notificaciones al iniciar sesion y crea el canal Android "Incidencias UTA".

Para probarlas:

1. Abrir "Configurar servidor".
2. Presionar "Probar notificacion".
3. Aceptar el permiso de notificaciones si Android lo solicita.
4. Verificar que aparezca la notificacion "Notificaciones activas".

Las notificaciones reales se muestran cuando:

- Un guardia recibe una nueva alerta por SignalR.
- Un estudiante recibe una alerta de un grupo de confianza por SignalR.

Nota: estas son notificaciones locales disparadas por la conexion en tiempo real de la app. Para recibir alertas con la app completamente cerrada se requiere integrar push remoto con Firebase Cloud Messaging.

## 5. Credenciales de prueba

Estudiantes:

```text
estudiante1@uta.edu.ec / 123456
estudiante2@uta.edu.ec / 123456
```

Guardias:

```text
guardia1@uta.edu.ec / 123456
guardia2@uta.edu.ec / 123456
```

Administrador:

```text
admin@uta.edu.ec / admin123
```

## 6. Flujo del estudiante

### Iniciar sesion

1. Abrir la aplicacion.
2. Ingresar correo y contrasena.
3. Si el usuario tiene rol Estudiante, la app abre el panel de estudiante.

### Enviar alerta

1. Entrar en la pestana "Alerta".
2. Seleccionar el motivo del incidente.
3. Mantener presionado el boton rojo durante 3 segundos.
4. Si se suelta antes de los 3 segundos, la alerta se cancela y no se envia.
5. Aceptar el permiso de ubicacion.
6. La app envia latitud, longitud, motivo, usuario y facultad al endpoint:

```text
POST /api/incidents
```

### Revisar historial

1. Entrar en "Historial".
2. Ver los incidentes reportados por el usuario.
3. Presionar "Ver detalle" para abrir datos del incidente y ruta en Maps.

### Crear grupo de confianza

1. Entrar en "Grupos".
2. Escribir el nombre del grupo.
3. Presionar "Crear grupo".
4. Seleccionar el grupo creado.
5. Agregar miembros por correo o ID.

### Invitar por QR/token

1. Seleccionar un grupo.
2. Presionar "Generar QR".
3. Mostrar el QR o copiar la invitacion.
4. El otro usuario puede pegar el token o URL en "Unirse a un grupo".

## 7. Flujo del guardia

### Ver alertas

1. Iniciar sesion con usuario guardia.
2. La app muestra las alertas activas.
3. Tambien escucha eventos en tiempo real por SignalR:

```text
/hubs/alerts
```

### Aceptar incidente

1. En una alerta pendiente, presionar "Aceptar".
2. La app llama:

```text
POST /api/incidents/accept
```

3. El incidente queda en estado ASIGNADO.

### Cerrar incidente

1. Presionar "Cerrar".
2. Escribir una observacion de minimo 20 caracteres.
3. Confirmar cierre.
4. La app llama:

```text
POST /api/incidents/close
```

5. El incidente queda en estado CERRADO.

### Rondas

1. Entrar en "Rondas".
2. Seleccionar zona.
3. Presionar "Iniciar ronda".
4. Para finalizar, escribir observacion y presionar "Finalizar ronda".

## 8. Compilacion para desarrolladores

Desde la carpeta:

```text
D:\SistemaSeguridad\MobileIonic
```

Instalar dependencias:

```bash
npm install
```

Compilar web:

```bash
npm run build
```

Sincronizar Capacitor:

```bash
npx cap sync android
```

Generar APK debug:

```bash
npm run apk:debug
```

Salida esperada:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 9. Prompt base para otro modelo LLM

Usar este contexto si se necesita pedir a otro modelo que mejore la app:

```text
Tenemos una app Android construida con Ionic React + Capacitor en MobileIonic. 
No se debe implementar logica de negocio en Java. La app consume un backend C# por gateway HTTP en /api y SignalR en /hubs/alerts. 
Debe mantener los flujos: login/registro, alerta de estudiante con GPS, historial, grupos de confianza con QR/token, panel de guardia, aceptar/cerrar incidentes, rondas y detalle con ruta en Maps.
```
