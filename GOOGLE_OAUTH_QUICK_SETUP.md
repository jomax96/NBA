# 🚀 Guía Rápida: Configurar Google OAuth

## Paso 1: Obtener Credenciales de Google

1. Ve a: https://console.cloud.google.com/
2. Selecciona o crea un proyecto
3. Ve a: **APIs & Services** > **Credentials**
4. Haz clic en: **+ CREATE CREDENTIALS** > **OAuth client ID**
5. Si te pide configurar OAuth consent screen:
   - Tipo: **External**
   - App name: `NBA Analytics Hub`
   - User support email: Tu email
   - Developer contact: Tu email
   - Scopes: Agrega `email` y `profile`
   - Test users: Agrega tu email de Google
6. Crea el OAuth Client ID:
   - Application type: **Web application**
   - Name: `NBA Analytics Hub`
   - **Authorized JavaScript origins**: `http://localhost`
   - **Authorized redirect URIs**: `http://localhost/api/auth/google/callback`
7. Copia el **Client ID** y **Client Secret**

## Paso 2: Configurar en el Proyecto

### Opción A: Usando archivo .env (Recomendado)

Crea un archivo `.env` en el directorio raíz del proyecto:

```bash
cd /home/jose/Documentos/NBA/nba-analytics-hub
```

Crea el archivo `.env`:

```bash
cat > .env << EOF
GOOGLE_CLIENT_ID=tu-client-id-aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret-aqui
EOF
```

### Opción B: Exportar variables antes de ejecutar Docker

```bash
export GOOGLE_CLIENT_ID="tu-client-id-aqui.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="tu-client-secret-aqui"
docker compose up -d --build
```

## Paso 3: Actualizar docker-compose.yml

El archivo `docker-compose.yml` ya está configurado para leer las variables de entorno. Solo necesitas:

1. Asegurarte de que el archivo `.env` existe con las credenciales
2. O exportar las variables antes de ejecutar docker compose

## Paso 4: Reiniciar los Servicios

```bash
cd /home/jose/Documentos/NBA/nba-analytics-hub
docker compose down
docker compose up -d --build
```

## Paso 5: Verificar que Funciona

1. Espera 30-60 segundos para que los servicios inicien
2. Abre: http://localhost/login
3. Haz clic en "Continuar con Google"
4. Deberías ser redirigido a Google para autenticarte

## ⚠️ Notas Importantes

- **Callback URL**: Debe ser exactamente `http://localhost/api/auth/google/callback`
- **No compartas**: Nunca compartas tu Client Secret públicamente
- **Desarrollo local**: `http://localhost` está permitido por Google sin HTTPS
- **Producción**: Necesitarás HTTPS y configurar las URLs de producción

## 🔧 Troubleshooting

### Error: "redirect_uri_mismatch"
- Verifica que la URL en Google Cloud Console sea exactamente: `http://localhost/api/auth/google/callback`
- Debe incluir `http://` (no `https://`)

### Error: "invalid_client"
- Verifica que las credenciales no tengan espacios extra
- Copia y pega directamente desde Google Cloud Console

### Error: "access_denied"
- Verifica que tu email esté en la lista de "Test users" en OAuth consent screen
- Asegúrate de haber agregado los scopes `email` y `profile`

