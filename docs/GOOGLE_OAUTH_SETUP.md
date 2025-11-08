# Configuración de Google OAuth

## Requisitos Previos

1. Tener una cuenta de Google
2. Acceder a [Google Cloud Console](https://console.cloud.google.com/)

## Pasos para Configurar Google OAuth

### 1. Crear un Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Nombra el proyecto (ej: "NBA Analytics Hub")

### 2. Habilitar Google+ API

1. En el menú lateral, ve a **APIs & Services** > **Library**
2. Busca "Google+ API" o "Google Identity"
3. Haz clic en **Enable**

### 3. Configurar OAuth Consent Screen

1. Ve a **APIs & Services** > **OAuth consent screen**
2. Selecciona **External** (para desarrollo)
3. Completa los campos requeridos:
   - **App name**: NBA Analytics Hub
   - **User support email**: Tu email
   - **Developer contact information**: Tu email
4. Haz clic en **Save and Continue**
5. En **Scopes**, agrega:
   - `email`
   - `profile`
6. Guarda y continúa

### 4. Crear Credenciales OAuth

1. Ve a **APIs & Services** > **Credentials**
2. Haz clic en **Create Credentials** > **OAuth client ID**
3. Selecciona **Web application**
4. Configura:
   - **Name**: NBA Analytics Hub Web Client
   - **Authorized JavaScript origins**:
     - `http://localhost`
     - `http://localhost:80`
     - `https://tu-dominio.com` (si tienes dominio)
   - **Authorized redirect URIs**:
     - `http://localhost/api/auth/google/callback`
     - `https://tu-dominio.com/api/auth/google/callback` (si tienes dominio)
5. Haz clic en **Create**
6. Copia el **Client ID** y **Client Secret**

### 5. Configurar Variables de Entorno

Crea un archivo `.env` en el directorio raíz del proyecto o configúralas en `docker-compose.yml`:

```bash
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_CALLBACK_URL=http://localhost/api/auth/google/callback
FRONTEND_URL=http://localhost
```

### 6. Configurar en Docker Compose

Si usas Docker Compose, puedes pasar las variables de entorno:

```bash
# En tu archivo .env o exportar antes de ejecutar docker compose
export GOOGLE_CLIENT_ID=tu-client-id
export GOOGLE_CLIENT_SECRET=tu-client-secret

# O crear un archivo .env en el directorio raíz
echo "GOOGLE_CLIENT_ID=tu-client-id" >> .env
echo "GOOGLE_CLIENT_SECRET=tu-client-secret" >> .env
```

Luego ejecuta:
```bash
docker compose up -d --build
```

### 7. Probar la Autenticación

1. Inicia el servidor
2. Accede a: `http://localhost/api/auth/google`
3. Deberías ser redirigido a Google para autenticarte
4. Después de autenticarte, serás redirigido de vuelta a la aplicación

## Notas Importantes

- **Solo funciona con HTTPS en producción**: Google requiere HTTPS para producción. Para desarrollo local, `http://localhost` está permitido.
- **Callback URL debe coincidir exactamente**: Debe coincidir exactamente con la configurada en Google Cloud Console.
- **Rate Limits**: Google tiene límites de rate para OAuth. En desarrollo, esto no debería ser un problema.
- **Seguridad**: Nunca compartas tu Client Secret públicamente. Úsalo solo en variables de entorno.

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Verifica que la URL de callback en `GOOGLE_CALLBACK_URL` coincida exactamente con la configurada en Google Cloud Console
- Asegúrate de incluir el protocolo (`http://` o `https://`)

### Error: "invalid_client"
- Verifica que `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` estén correctamente configurados
- Asegúrate de que las credenciales no tengan espacios extra

### Error: "access_denied"
- El usuario canceló la autenticación
- Verifica que los scopes estén configurados correctamente

## Producción

Para producción, necesitas:
1. Cambiar el tipo de app a **Internal** o completar la verificación de OAuth consent screen
2. Usar HTTPS
3. Configurar las URLs de producción en Google Cloud Console
4. Actualizar las variables de entorno con las URLs de producción

