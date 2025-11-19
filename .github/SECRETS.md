# Configuración de Secrets en GitHub

Este documento explica cómo configurar los secrets necesarios para que el pipeline de CI/CD funcione correctamente.

## 📋 Secrets Requeridos

Para que el pipeline funcione, debes configurar los siguientes secrets en GitHub:

### 🔐 Secrets Obligatorios

| Secret Name | Descripción | Ejemplo |
|------------|-------------|---------|
| `MYSQL_ROOT_PASSWORD` | Contraseña del usuario root de MySQL | `rootpassword123` |
| `MYSQL_PASSWORD` | Contraseña del usuario de aplicación MySQL | `nba_password123` |
| `MONGODB_ROOT_PASSWORD` | Contraseña del usuario root de MongoDB | `adminpassword123` |
| `RABBITMQ_PASSWORD` | Contraseña del usuario de RabbitMQ | `adminpassword123` |
| `JWT_SECRET` | Secret key para firmar tokens JWT | `tu-secret-key-super-segura-aqui` |

### 🔧 Secrets Opcionales (con valores por defecto)

| Secret Name | Descripción | Valor por Defecto |
|------------|-------------|-------------------|
| `MYSQL_USER` | Usuario de MySQL | `nba_user` |
| `MYSQL_DATABASE` | Nombre de la base de datos MySQL | `nba_db` |
| `MONGODB_ROOT_USERNAME` | Usuario root de MongoDB | `admin` |
| `RABBITMQ_USER` | Usuario de RabbitMQ | `admin` |

## 🚀 Cómo Configurar los Secrets

### Paso 1: Ir a la configuración del repositorio

1. Ve a tu repositorio en GitHub: `https://github.com/jomax96/NBA`
2. Haz clic en **Settings** (Configuración)
3. En el menú lateral, haz clic en **Secrets and variables** → **Actions**

### Paso 2: Agregar cada secret

1. Haz clic en **New repository secret**
2. Ingresa el **Name** (nombre del secret, exactamente como aparece en la tabla)
3. Ingresa el **Value** (el valor del secret)
4. Haz clic en **Add secret**

### Paso 3: Repetir para todos los secrets

Repite el proceso para cada secret de la lista de **Secrets Obligatorios**.

## ⚠️ Importante

- **Nunca** subas los valores de los secrets al código
- Los secrets son **solo lectura** una vez creados (no puedes ver su valor después)
- Si necesitas cambiar un secret, debes eliminarlo y crearlo de nuevo
- Los secrets solo están disponibles en el contexto de GitHub Actions

## 🔒 Recomendaciones de Seguridad

1. **Usa contraseñas fuertes**: Genera contraseñas aleatorias y seguras
2. **No reutilices contraseñas**: Cada servicio debe tener su propia contraseña única
3. **Rota los secrets periódicamente**: Cambia las contraseñas regularmente
4. **No compartas los secrets**: Solo los administradores del repositorio deben tener acceso

## 📝 Generar Contraseñas Seguras

Puedes generar contraseñas seguras usando:

```bash
# Linux/Mac
openssl rand -base64 32

# O usando Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

## ✅ Verificar que los Secrets Están Configurados

Después de configurar los secrets, el pipeline debería ejecutarse correctamente. Si ves errores relacionados con variables de entorno, verifica que:

1. Los nombres de los secrets coincidan exactamente (son case-sensitive)
2. Todos los secrets obligatorios estén configurados
3. Los valores no tengan espacios al inicio o final

## 🐛 Troubleshooting

### Error: "Secret not found"
- Verifica que el nombre del secret coincida exactamente
- Asegúrate de que el secret esté configurado en el repositorio correcto

### Error: "Authentication failed"
- Verifica que las contraseñas sean correctas
- Asegúrate de que no haya espacios adicionales en los valores

### El pipeline falla en los tests
- Verifica que todos los secrets obligatorios estén configurados
- Revisa los logs del pipeline para ver qué secret falta

