# Plataforma de Telemedicina — Backend (API + WebSockets)

Capa de servicios web del TEG **“Plataforma para la comunicación multimedia en tiempo real entre pacientes y profesionales del sector de la salud”**.

Expone una API REST y dos gateways de Socket.io (señalización WebRTC y chat en tiempo real) que alimentan al aplicativo móvil (React Native) y al portal web (React.js).

---

## 1. Stack

| Capa                | Tecnología                          |
|---------------------|-------------------------------------|
| Runtime             | Node.js 20                          |
| Framework           | NestJS 10 (TypeScript, decoradores) |
| Base de datos       | MongoDB 7 + Mongoose 8              |
| Auth                | Passport + JWT (Bearer)             |
| Tiempo real         | Socket.io 4                          |
| Video P2P           | WebRTC (el backend sólo señaliza)   |
| Mail                | Nodemailer                          |
| Documentación API   | Swagger / OpenAPI (en `/api/docs`)  |
| Testing             | Jest + Supertest                    |

---

## 2. Arranque rápido

### Opción A — Docker Compose (recomendado para desarrollo)

```bash
cp .env.example .env
docker compose up --build
```

Servicios que levanta:

- `api`       → http://localhost:3000
- `mongo`     → mongodb://localhost:27017
- `mailhog`   → http://localhost:8025 (UI web para leer los correos de reset)

### Opción B — Local sin Docker

Requisitos: Node 20+, MongoDB 7 corriendo localmente.

```bash
cp .env.example .env          # ajustar variables
npm install
npm run start:dev             # hot reload
```

Documentación interactiva: http://localhost:3000/api/docs

---

## 3. Variables de entorno

Todas están comentadas en `.env.example`. Las críticas:

| Variable              | Descripción                                              |
|-----------------------|----------------------------------------------------------|
| `MONGO_URI`           | URI de conexión a Mongo                                  |
| `JWT_SECRET`          | Secreto de firma del JWT de sesión                       |
| `JWT_EXPIRES_IN`      | Duración del JWT (`1d`, `12h`, etc.)                     |
| `JWT_RESET_SECRET`    | Secreto para tokens de recuperación                      |
| `JWT_RESET_EXPIRES_IN`| Validez del link de reset (24h por spec)                 |
| `BCRYPT_ROUNDS`       | Costo bcrypt (10 por defecto)                            |
| `MAX_LOGIN_ATTEMPTS`  | Intentos antes de bloquear la cuenta (3 por spec)        |
| `MAX_FILE_SIZE`       | Bytes máximos por archivo (1 MB por defecto)             |
| `STUN_URL` / `TURN_*` | Servidores ICE que el endpoint `/api/auth/ice-servers` entrega a los clientes |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Si están definidos, crean un admin al arrancar |

Para generar un `JWT_SECRET` fuerte:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 4. Estructura del proyecto

```
src/
├── main.ts                      Bootstrap (helmet, CORS, Swagger, pipes, filtros)
├── app.module.ts                Módulo raíz + seed de admin
├── health.controller.ts         GET /health (fuera del prefijo /api)
│
├── config/
│   └── configuration.ts         Factoría de ConfigService
│
├── common/
│   ├── filters/                 HttpExceptionFilter global
│   ├── decorators/              @Roles, @CurrentUser
│   └── guards/                  RolesGuard
│
├── schemas/                     Schemas Mongoose con decoradores @nestjs/mongoose
│   ├── user.schema.ts           Colección usuarios
│   ├── access-code.schema.ts    Colección codigos_acceso
│   ├── case.schema.ts           Colección casos
│   ├── message.schema.ts        Colección mensajes
│   ├── video-session.schema.ts  Colección sesiones_video
│   ├── token.schema.ts          Colección tokens (TTL)
│   └── waiting-room.schema.ts   Colección sala_espera
│
├── mail/                        Servicio global de correo
│
└── modules/
    ├── auth/                    Login, JWT, Passport, reset de contraseña, WsJwtGuard
    ├── users/                   Registro paciente, alta médicos, perfil propio
    ├── access-codes/            CRUD de códigos (admin)
    ├── cases/                   CRUD base de casos clínicos
    ├── waiting-room/            Cola FIFO
    ├── chat/                    REST + ChatGateway (Socket.io)
    ├── video/                   REST + VideoGateway (señalización WebRTC)
    └── files/                   Subida y descarga (Base64) dentro de un caso
```

Cada módulo agrupa: `*.module.ts`, `*.service.ts`, `*.controller.ts`, DTOs (`class-validator`), y — cuando aplica — un `*.gateway.ts` para Socket.io.

---

## 5. Modelo de datos

Siete colecciones Mongo alineadas con el alcance del TEG:

| Colección        | Propósito                                                   |
|------------------|-------------------------------------------------------------|
| `usuarios`       | Pacientes, médicos y administradores (campo `role`)         |
| `codigos_acceso` | Invitaciones de un solo uso generadas por el admin          |
| `casos`          | Consulta/caso clínico (tipo chat o video, estado, etc.)     |
| `mensajes`       | Mensajes de texto (300 chars) o archivos (Base64) del caso  |
| `sesiones_video` | Metadatos de cada videoconferencia (no media)               |
| `tokens`         | Tokens auxiliares con TTL (reset de contraseña)             |
| `sala_espera`    | Cola FIFO de pacientes sin médico disponible                |

Seguridad: contraseñas siempre con bcrypt, JWT firmado por `JWT_SECRET`, tokens de reset guardados como hash SHA-256 (nunca el crudo), TTL index para que Mongo borre automáticamente los tokens vencidos.

---

## 6. Roles y autorización

- **PACIENTE** — usuarios del aplicativo móvil. Pueden registrarse con un código de acceso, iniciar chats/videos y subir archivos dentro de sus casos.
- **MEDICO** — usuarios del portal web. Los crea el admin. Atienden casos, cierran casos, ven la lista de espera.
- **ADMIN** — gestiona códigos de acceso y crea médicos.

El control de acceso combina dos guards:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
```

`JwtAuthGuard` valida el token; `RolesGuard` valida el rol contra la metadata puesta por `@Roles()`.

Para eventos de Socket.io el equivalente es `WsJwtGuard`, que lee el JWT del handshake (`auth.token` o header `Authorization`).

---

## 7. Endpoints REST

Todos cuelgan de `/api` salvo `/health`.

### 7.1 Auth (`/api/auth`)

| Método | Ruta               | Auth | Descripción                                            |
|--------|--------------------|------|--------------------------------------------------------|
| POST   | `/login`           | —    | Devuelve `{ accessToken, user }`                       |
| POST   | `/forgot-password` | —    | Envía correo de reset (responde 204 siempre)           |
| POST   | `/reset-password`  | —    | Consume token y fija contraseña nueva                  |
| GET    | `/me`              | JWT  | Perfil del usuario autenticado                         |
| POST   | `/logout`          | JWT  | 204 (el cliente descarta el token)                     |
| GET    | `/ice-servers`     | —    | Config de STUN/TURN para el `RTCPeerConnection`        |

### 7.2 Usuarios (`/api/users`)

| Método | Ruta        | Auth  | Descripción                                      |
|--------|-------------|-------|--------------------------------------------------|
| POST   | `/register` | —     | Registro de paciente (consume un código)         |
| GET    | `/me`       | JWT   | Datos propios                                    |
| PATCH  | `/me`       | JWT   | Modificar email/nombre/contraseña                |
| POST   | `/doctors`  | ADMIN | Alta de un médico                                |

### 7.3 Códigos de acceso (`/api/access-codes`) — sólo ADMIN

| Método | Ruta       | Descripción                            |
|--------|------------|----------------------------------------|
| POST   | `/`        | Genera un código legible de 8 chars    |
| GET    | `/`        | Lista todos los códigos                |
| DELETE | `/:id`     | Revoca un código no consumido          |

### 7.4 Sala de espera (`/api/waiting-room`)

| Método | Ruta        | Rol      | Descripción                               |
|--------|-------------|----------|-------------------------------------------|
| POST   | `/join`     | PACIENTE | Entrar en la cola (FIFO)                  |
| DELETE | `/leave`    | PACIENTE | Salir voluntariamente                     |
| GET    | `/position` | PACIENTE | Posición 1-indexada                       |
| GET    | `/`         | MEDICO   | Lista ordenada por antigüedad             |

### 7.5 Casos (`/api/cases`)

| Método | Ruta            | Rol    | Descripción                      |
|--------|-----------------|--------|----------------------------------|
| GET    | `/mine`         | JWT    | Casos del usuario actual         |
| GET    | `/:id`          | JWT    | Caso por ID                      |
| PATCH  | `/:id/close`    | MEDICO | Cerrar (con diagnóstico opcional)|

### 7.6 Chat (`/api/chat`)

| Método | Ruta                        | Rol      | Descripción                          |
|--------|-----------------------------|----------|--------------------------------------|
| POST   | `/start`                    | PACIENTE | Inicia un caso de chat               |
| GET    | `/cases/:id/messages`       | JWT      | Historial del caso                   |
| POST   | `/cases/:id/read`           | JWT      | Marca mensajes como leídos           |

(Los envíos de mensajes vía Socket.io — ver sección 8.)

### 7.7 Video (`/api/video`)

| Método | Ruta            | Rol      | Descripción                                                  |
|--------|-----------------|----------|--------------------------------------------------------------|
| POST   | `/start`        | PACIENTE | Crea sesión contra el médico disponible menos cargado        |
| POST   | `/:id/accept`   | MEDICO   | Acepta (pasa a ACTIVE)                                       |
| POST   | `/:id/reject`   | MEDICO   | Rechaza                                                      |
| POST   | `/:id/end`      | JWT      | Finaliza la llamada (cualquiera de los participantes)        |

### 7.8 Archivos (`/api/files`)

| Método | Ruta                        | Rol | Descripción                                    |
|--------|-----------------------------|-----|------------------------------------------------|
| POST   | `/cases/:caseId/upload`     | JWT | Sube Base64, valida mime+peso, notifica peer   |
| GET    | `/messages/:messageId`      | JWT | Descarga el Base64 completo                    |

---

## 8. Protocolo de Socket.io

Dos namespaces:

### 8.1 `/chat`

Autenticación: JWT en `handshake.auth.token` o header `Authorization: Bearer`.

| Dirección   | Evento         | Payload                                      |
|-------------|----------------|----------------------------------------------|
| cliente → | `join-case`    | `{ caseId }`                                 |
| cliente → | `leave-case`   | `{ caseId }`                                 |
| cliente → | `send-message` | `{ caseId, content }` (validado, max 300)    |
| cliente → | `typing`       | `{ caseId, typing: boolean }`                |
| servidor → | `message`      | documento del mensaje persistido             |
| servidor → | `typing`       | `{ userId, typing }`                         |
| servidor → | `case-closed`  | `{ caseId }`                                 |

Ejemplo (cliente JS):

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/chat', {
  auth: { token: 'eyJhbGciOi...' },
});

socket.emit('join-case', { caseId: '65a...' });

socket.on('message', (msg) => console.log('Nuevo mensaje:', msg));

socket.emit('send-message', { caseId: '65a...', content: 'Hola doctor' });
```

### 8.2 `/video` (señalización WebRTC)

El backend **sólo** intercambia SDP e ICE candidates. El audio/video va P2P.

| Dirección    | Evento          | Payload                                     |
|--------------|-----------------|---------------------------------------------|
| cliente →  | `join-session`  | `{ sessionId }`                             |
| cliente →  | `offer`         | `{ sessionId, sdp }`                        |
| cliente →  | `answer`        | `{ sessionId, sdp }`                        |
| cliente →  | `ice-candidate` | `{ sessionId, candidate }`                  |
| cliente →  | `hangup`        | `{ sessionId }`                             |
| servidor → | `peer-joined`   | `{ userId }`                                |
| servidor → | `offer`         | `{ from, sdp }`                             |
| servidor → | `answer`        | `{ from, sdp }`                             |
| servidor → | `ice-candidate` | `{ from, candidate }`                       |
| servidor → | `peer-left`     | `{ userId }`                                |
| servidor → | `hangup`        | `{ from }`                                  |

Flujo completo de una videollamada:

```
Paciente            Backend (Socket.io)        Médico
   │                       │                     │
   │── POST /api/video/start                     │
   │                       │                     │
   │<── { sessionId } ─────┤                     │
   │                       │                     │
   │── join-session ──────▶│                     │
   │                       │──▶ peer-joined ────▶│
   │                       │                     │
   │                       │◀── join-session ────│
   │◀── peer-joined ───────┤                     │
   │                       │                     │
   │── offer (SDP) ───────▶│── offer ───────────▶│
   │                       │                     │
   │◀─── answer (SDP) ─────┤◀── answer ──────────│
   │                       │                     │
   │── ice-candidate ─────▶│── ice-candidate ───▶│
   │                       │                     │
   │◀── ice-candidate ─────┤◀── ice-candidate ───│
   │   ...                                       │
   │═══════════ P2P media (WebRTC) ══════════════│
   │                                             │
   │── hangup ────────────▶│── hangup ──────────▶│
   │                       │                     │
```

---

## 9. Flujos de negocio end-to-end

### 9.1 Registro y primer login (paciente)

1. El admin ejecuta `POST /api/access-codes` y entrega el código al paciente.
2. El paciente llama `POST /api/users/register` con el código + email + password.
3. Login con `POST /api/auth/login` → recibe JWT.
4. Todas las llamadas posteriores llevan `Authorization: Bearer <JWT>`.

### 9.2 Recuperación de contraseña

1. `POST /api/auth/forgot-password { email }` — siempre responde 204.
2. Si el email existe, se envía un correo con un link tipo `https://frontend/reset-password?token=xxxx` (el token crudo sólo viaja por correo; el servidor guarda sólo su SHA-256).
3. El frontend llama `POST /api/auth/reset-password { token, newPassword }`.
4. Se marca el token como usado y se desbloquea la cuenta si estaba bloqueada.

### 9.3 Videollamada con lista de espera

1. Paciente `POST /api/video/start`:
   - Si hay médico disponible → responde con `{ session, case, doctor }`.
   - Si no hay → responde `404`; el cliente ofrece `POST /api/waiting-room/join` o `tel:` al call center.
2. Ambos peers conectan al namespace `/video` y emiten `join-session`.
3. Intercambio de `offer` / `answer` / `ice-candidate` hasta establecer P2P.
4. Al colgar, se emite `hangup` y el backend cierra caso + sesión + decrementa la carga del médico.

### 9.4 Envío de archivo dentro de un chat

1. `POST /api/files/cases/:caseId/upload` con `{ fileName, mimeType, size, data (base64) }`.
2. Backend valida mime ∈ {pdf, jpeg, png}, `size ≤ 1 MB`, tamaño real = tamaño declarado.
3. Persiste el mensaje con `kind=file`.
4. Emite por el ChatGateway una versión *ligera* (sin `fileData`) al otro peer.
5. El receptor descarga el contenido con `GET /api/files/messages/:messageId` cuando el usuario abre la miniatura.

---

## 10. Seguridad

- **Contraseñas**: bcrypt con costo configurable (10 por defecto).
- **JWT**: firmado con `JWT_SECRET`; nunca se persiste en BD.
- **Bloqueo**: tras `MAX_LOGIN_ATTEMPTS` fallos la cuenta queda `isActive=false`; se desbloquea al completar el reset.
- **Tokens de reset**: guardados sólo como hash SHA-256 + TTL de 24h + índice TTL en Mongo.
- **Validación**: `ValidationPipe` global con `whitelist: true` + `forbidNonWhitelisted: true`.
- **Rate limiting**: `ThrottlerGuard` global (120 req/min por IP, ajustable).
- **Headers**: `helmet` activado.
- **CORS**: lista blanca por `CORS_ORIGINS`.
- **Archivos**: whitelist de mime, tamaño duro, el peso real se mide tras decodificar el Base64 para evitar trampas.
- **Filtro global** de excepciones que normaliza los errores y oculta detalles internos.

---

## 11. Tests

```bash
npm test                 # unit tests (Jest)
npm run test:e2e         # smoke e2e (requiere Mongo accesible)
npm run test:cov         # cobertura
```

---

## 12. Comandos npm

| Comando                  | Descripción                          |
|--------------------------|--------------------------------------|
| `npm run start:dev`      | Dev con hot reload                   |
| `npm run start:debug`    | Dev con inspector de Node            |
| `npm run build`          | Compila a `dist/`                    |
| `npm run start:prod`     | Ejecuta `dist/main.js`               |
| `npm run lint`           | ESLint + fix                         |
| `npm run format`         | Prettier                             |

---

## 13. Qué queda fuera (y por qué)

- **Servidor TURN**: se expone la configuración por `/api/auth/ice-servers`, pero el TURN se hospeda aparte (coturn propio o Twilio/Xirsys/Cloudflare Calls). Documentado en la sección 5 del TEG como dependencia de infraestructura.
- **Almacenamiento S3 para archivos**: el TEG pide persistir Base64 en la BD; en un siguiente sprint se recomienda migrar a blob storage (GridFS o S3) para no inflar Mongo.
- **Integración con directorio activo** (mencionada en el TEG para médicos): el esqueleto de `UsersService.createDoctor` queda listo para intercambiar la estrategia local por LDAP/ADFS.
- **Observabilidad** (Prometheus, tracing): se puede sumar con `@nestjs/terminus` + `prom-client` en una iteración posterior.

---

