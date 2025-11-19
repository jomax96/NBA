# Instructivo para Ejecutar Pruebas Locales

Este documento explica cómo configurar y ejecutar las pruebas del proyecto localmente.

## 📋 Prerequisitos

- Python 3.11 o superior
- Node.js 18 o superior
- Docker y Docker Compose instalados
- npm instalado

---

## 🐍 Parte 1: Configurar Entorno Python para Pruebas ML

### Paso 1: Verificar Python instalado

```bash
python3 --version
# Debe mostrar Python 3.11 o superior
```

### Paso 2: Verificar si venv está disponible

Primero verifica si `venv` ya está instalado:

```bash
python3 -m venv --help
```

Si funciona, puedes saltar al Paso 3. Si da error, continúa con la instalación.

### Paso 3: Instalar pip y venv (si no están instalados)

**⚠️ Nota:** Necesitas permisos de superusuario (`sudo`) para instalar paquetes del sistema.

```bash
# En Ubuntu/Debian (para Python 3.12):
sudo apt update
sudo apt install -y python3.12-venv python3-pip

# O si prefieres la versión genérica (funciona con cualquier Python 3.x):
sudo apt update
sudo apt install -y python3-venv python3-pip

# En macOS (con Homebrew):
brew install python3
```

**Nota:** Si tienes Python 3.3 o superior, `venv` debería venir incluido. Si no funciona, instala el paquete específico de tu versión de Python.

### Paso 4: Crear entorno virtual

```bash
cd /home/jose/Documentos/NBA/nba-analytics-hub/microservices/ml-predictions
python3 -m venv venv
```

### Paso 5: Activar el entorno virtual

```bash
# En Linux/macOS:
source venv/bin/activate

# En Windows:
venv\Scripts\activate
```

Verás que el prompt cambia a `(venv)` indicando que el entorno está activo.

### Paso 6: Instalar dependencias

```bash
# Actualizar pip
python -m pip install --upgrade pip

# Instalar dependencias del proyecto
pip install -r requirements.txt

# Verificar instalación
pip list
```

### Paso 7: Configurar variables de entorno

Antes de ejecutar las pruebas, necesitas configurar las variables de entorno. Puedes crear un archivo `.env` o exportarlas:

```bash
export PYTHONPATH=.
export MYSQL_HOST=localhost
export MYSQL_USER=nba_user
export MYSQL_PASSWORD=nba_password
export MYSQL_DATABASE=nba_db
```

**Nota:** Asegúrate de que MySQL esté corriendo (ver Parte 2) antes de ejecutar las pruebas.

### Paso 8: Ejecutar pruebas ML

**⚠️ Importante:** Asegúrate de haber exportado `PYTHONPATH=.` (Paso 7) antes de ejecutar las pruebas.

```bash
# Desde el directorio microservices/ml-predictions
# Asegúrate de que el entorno virtual esté activado y PYTHONPATH configurado
pytest tests/ -v --tb=short

# Con cobertura:
pytest tests/ --cov=. --cov-report=html -v

# O ejecutar todo en un solo comando:
export PYTHONPATH=. && pytest tests/ -v --tb=short
```

**Nota:** Si olvidaste exportar `PYTHONPATH`, verás el error `ModuleNotFoundError: No module named 'app'`. En ese caso, simplemente ejecuta `export PYTHONPATH=.` y vuelve a correr las pruebas.

### Paso 9: Desactivar entorno virtual (cuando termines)

```bash
deactivate
```

---

## 🐳 Parte 2: Iniciar Servicios Docker para Tests E2E

### Paso 1: Verificar Docker

```bash
docker --version
docker compose version
```

### Paso 2: Navegar al directorio raíz del proyecto

```bash
cd /home/jose/Documentos/NBA/nba-analytics-hub
```

### Paso 3: Iniciar servicios necesarios

Inicia solo los servicios de base de datos y mensajería (sin el backend/frontend):

```bash
docker compose up -d mysql mongodb redis rabbitmq
```

### Paso 4: Verificar que los servicios estén corriendo

```bash
docker compose ps
```

Deberías ver los 4 servicios con estado "Up (healthy)" o "Up".

### Paso 5: Verificar conectividad de los servicios

```bash
# Verificar MySQL
docker exec nba-mysql mysqladmin ping -h localhost -u root -prootpassword

# Verificar MongoDB
docker exec nba-mongodb mongosh --eval "db.adminCommand('ping')"

# Verificar Redis
docker exec nba-redis redis-cli ping
# Debe responder: PONG

# Verificar RabbitMQ
docker exec nba-rabbitmq rabbitmq-diagnostics ping
```

### Paso 6: Ver logs de los servicios (opcional)

```bash
# Ver logs de todos los servicios
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f mysql
docker compose logs -f mongodb
```

---

## 🧪 Parte 3: Ejecutar Pruebas E2E

### Paso 1: Instalar dependencias del backend

```bash
cd /home/jose/Documentos/NBA/nba-analytics-hub/backend
npm ci
```

### Paso 2: Instalar dependencias de los tests E2E

```bash
cd /home/jose/Documentos/NBA/nba-analytics-hub/tests/e2e
npm ci
```

### Paso 3: Configurar variables de entorno para el backend

Crea un archivo `.env` en el directorio `backend/` o exporta las variables:

```bash
export NODE_ENV=test
export MYSQL_HOST=localhost
export MYSQL_USER=nba_user
export MYSQL_PASSWORD=nba_password
export MYSQL_DATABASE=nba_db
export MONGODB_URI=mongodb://admin:adminpassword@localhost:27017/nba_users?authSource=admin
export REDIS_HOST=localhost
export REDIS_PORT=6379
export RABBITMQ_HOST=localhost
export RABBITMQ_USER=admin
export RABBITMQ_PASS=adminpassword
export JWT_SECRET=tu_jwt_secret_aqui
export PORT=3000
```

**Nota:** Los valores por defecto están en `docker-compose.yml`. Asegúrate de usar los mismos valores.

### Paso 4: Iniciar el servidor backend en modo test

En una terminal, desde el directorio `backend/`:

```bash
cd /home/jose/Documentos/NBA/nba-analytics-hub/backend
npm start > server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
```

Espera a que el servidor esté listo (puede tardar unos segundos):

```bash
# Verificar que el servidor esté listo
for i in {1..30}; do
  if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Server is ready!"
    break
  fi
  echo "Waiting for server... ($i/30)"
  sleep 1
done
```

### Paso 5: Ejecutar pruebas E2E

En otra terminal:

```bash
cd /home/jose/Documentos/NBA/nba-analytics-hub/tests/e2e
npm test
```

### Paso 6: Detener el servidor backend (cuando termines)

```bash
# Si guardaste el PID:
kill $SERVER_PID

# O encontrar y matar el proceso:
pkill -f "node.*server.js"
```

---

## 🛑 Detener Servicios Docker

Cuando termines de ejecutar las pruebas:

```bash
cd /home/jose/Documentos/NBA/nba-analytics-hub
docker compose down
```

Para detener y eliminar los volúmenes (⚠️ esto elimina los datos):

```bash
docker compose down -v
```

---

## 📝 Resumen de Comandos Rápidos

### Configurar Python y ejecutar pruebas ML:
```bash
cd microservices/ml-predictions
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
export PYTHONPATH=.
pytest tests/ -v --tb=short
deactivate
```

### Iniciar servicios y ejecutar E2E:
```bash
# Terminal 1: Iniciar servicios
cd /home/jose/Documentos/NBA/nba-analytics-hub
docker compose up -d mysql mongodb redis rabbitmq

# Terminal 2: Iniciar backend
cd backend
npm start &

# Terminal 3: Ejecutar E2E
cd tests/e2e
npm test
```

---

## ❓ Solución de Problemas

### Error: "ModuleNotFoundError: No module named 'app'"
- Asegúrate de haber exportado `PYTHONPATH=.` antes de ejecutar pytest
- Verifica que estés en el directorio `microservices/ml-predictions`

### Error: "Connection refused" en las pruebas
- Verifica que los servicios Docker estén corriendo: `docker compose ps`
- Verifica que los servicios estén saludables: `docker compose ps` debe mostrar "healthy"
- Espera unos segundos después de iniciar los servicios para que estén completamente listos

### Error: "EADDRINUSE: address already in use"
- El puerto 3000 está en uso. Encuentra y mata el proceso:
  ```bash
  lsof -ti:3000 | xargs kill -9
  ```

### Error: "npm ci" falla
- Asegúrate de tener `package-lock.json` en el directorio
- Si no existe, ejecuta `npm install` primero

---

## 📚 Referencias

- Variables de entorno por defecto: `docker-compose.yml`
- Configuración CI: `.github/workflows/ci.yml`
- Requisitos Python: `microservices/ml-predictions/requirements.txt`

