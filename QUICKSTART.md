# 🚀 Guía Rápida de Inicio - NBA Analytics Hub

## ✅ Verificación de Arquitectura

La arquitectura es **FUNCIONAL** y está completa con:
- ✅ 3 nodos backend con balanceador NGINX
- ✅ MongoDB como SPOF intencional con Circuit Breaker
- ✅ MySQL Read-Only para datos NBA
- ✅ Redis Cache para lecturas
- ✅ RabbitMQ para escrituras asíncronas
- ✅ Queue Worker para procesar cola
- ✅ 2 microservicios (ML Predictions + Notifications)
- ✅ Monitoreo con Prometheus y Grafana

## 📋 Prerrequisitos

Asegúrate de tener instalado:
- **Docker** 20.10 o superior
- **Docker Compose** 2.0 o superior (usar `docker compose` - dos palabras)
- **8GB RAM** mínimo (recomendado 16GB)
- **20GB espacio** en disco

Verificar instalación:
```bash
docker --version
docker compose version
```

## 🎯 Pasos para Ejecutar el Proyecto

### 1. Navegar al directorio del proyecto

```bash
cd /home/jose/Documentos/NBA/nba-analytics-hub
```

### 2. Iniciar todos los servicios

**IMPORTANTE**: Usa `docker compose` (dos palabras), NO `docker-compose`:

```bash
# Construir e iniciar todos los contenedores
docker compose up -d --build

# Ver logs en tiempo real (opcional)
docker compose logs -f
```

**Nota**: La primera vez puede tardar 5-10 minutos mientras descarga imágenes y construye contenedores.

### 3. Verificar que todos los servicios estén corriendo

```bash
# Ver estado de todos los servicios
docker compose ps

# Deberías ver todos los servicios "Up" o "healthy"
```

### 4. Verificar salud de los servicios

```bash
# Health check del backend (a través de NGINX)
curl http://localhost/api/health

# Health check directo de un nodo (a través de NGINX)
curl http://localhost/api/health

# Health check de ML Service
curl http://localhost:5000/health

# Health check de Notifications
curl http://localhost:4000/health
```

### 5. Acceder a la aplicación

Abre tu navegador y accede a:

- **Frontend Principal**: http://localhost:80
- **Grafana** (Monitoreo): http://localhost:3004
  - Usuario: `admin`
  - Password: `admin`
- **Prometheus** (Métricas): http://localhost:9090
- **RabbitMQ Management**: http://localhost:15672
  - Usuario: `admin`
  - Password: `adminpassword`
- **Redis Commander**: http://localhost:8081

## 🧪 Pruebas Rápidas

### Prueba 1: Obtener equipos

```bash
curl http://localhost/api/teams
```

Debería retornar lista de equipos (primera vez desde BD, segunda vez desde caché).

### Prueba 2: Obtener jugadores

```bash
curl http://localhost/api/players/top
```

### Prueba 3: Registrar usuario (se encola en RabbitMQ)

```bash
curl -X POST http://localhost/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "name": "Test User"
  }'
```

### Prueba 4: Obtener predicción

```bash
curl -X POST http://localhost/api/predictions/predict \
  -H "Content-Type: application/json" \
  -d '{
    "homeTeamId": 1,
    "visitorTeamId": 2
  }'
```

## 🔧 Comandos Útiles

### Ver logs de un servicio específico

```bash
# Backend Node 1
docker compose logs -f backend-node1

# MySQL
docker compose logs -f mysql

# MongoDB
docker compose logs -f mongodb

# Redis
docker compose logs -f redis

# RabbitMQ
docker compose logs -f rabbitmq
```

### Detener servicios

```bash
# Detener todos los servicios
docker compose down

# Detener y eliminar volúmenes (⚠️ borra datos)
docker compose down -v
```

### Reiniciar un servicio específico

```bash
# Reiniciar backend Node 1
docker compose restart backend-node1

# Reiniciar MongoDB
docker compose restart mongodb
```

### Reconstruir imágenes

```bash
# Reconstruir todas las imágenes
docker compose build --no-cache

# Reconstruir solo backend
docker compose build backend-node1
```

## 🧪 Prueba de Tolerancia a Fallos

### Simular caída de MongoDB (SPOF intencional)

```bash
# Detener MongoDB
docker compose stop mongodb

# Verificar que el sistema sigue respondiendo
curl http://localhost/api/health

# Intentar registro (debería encolarse en RabbitMQ)
curl -X POST http://localhost/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com",
    "password": "test123",
    "name": "Test User 2"
  }'

# Verificar cola en RabbitMQ Management
# http://localhost:15672 → Queues → user.operations

# Recuperar MongoDB
docker compose start mongodb

# Esperar ~10-15 segundos para que el Queue Worker procese
# Verificar que el usuario se registró (en RabbitMQ Management)
```

### Usar script de prueba automático

```bash
# Dar permisos de ejecución
chmod +x scripts/test-failure.sh

# Ejecutar prueba
./scripts/test-failure.sh
```

## 📊 Verificar Métricas

### Prometheus

1. Accede a http://localhost:9090
2. Ejecuta queries como:
   - `up` - Ver servicios activos
   - `rate(http_requests_total[5m])` - Requests por segundo

### Grafana

1. Accede a http://localhost:3004
2. Login: admin/admin
3. Configura Prometheus como datasource:
   - Settings → Data Sources → Add → Prometheus
   - URL: http://prometheus:9090
   - Save & Test

## 🐛 Troubleshooting

### Problema: `docker-compose` no funciona

**Solución**: Usa `docker compose` (dos palabras):
```bash
docker compose up -d
```

### Problema: Servicios no inician

```bash
# Ver logs detallados
docker compose logs

# Verificar espacio en disco
df -h

# Verificar memoria
free -h
```

### Problema: Puerto ya en uso

```bash
# Ver qué está usando el puerto
sudo lsof -i :80
sudo lsof -i :3000

# Detener el servicio que lo usa o cambiar puerto en docker-compose.yml
```

### Problema: MySQL no conecta

```bash
# Verificar logs
docker compose logs mysql

# Verificar que MySQL esté healthy
docker compose ps mysql

# Reiniciar MySQL
docker compose restart mysql

# Si está corrupto, eliminar volumen y recrear
docker compose down mysql
docker volume rm nba-analytics-hub_mysql_data
docker compose up -d mysql
```

### Problema: Frontend no carga

```bash
# Verificar que NGINX esté corriendo
docker compose ps nginx

# Ver logs de NGINX
docker compose logs nginx

# Verificar que frontend se construyó correctamente
docker compose logs frontend
```

### Problema: Backend nodes reiniciando

```bash
# Ver logs del backend
docker compose logs backend-node1

# Verificar que todas las dependencias estén healthy
docker compose ps mysql mongodb redis rabbitmq
```

## ✅ Checklist de Verificación

Antes de considerar que todo funciona:

- [ ] Todos los servicios están "Up" en `docker compose ps`
- [ ] Health check retorna 200: `curl http://localhost/api/health`
- [ ] Frontend carga en http://localhost:80
- [ ] Puedo obtener equipos: `curl http://localhost/api/teams`
- [ ] Puedo obtener jugadores: `curl http://localhost/api/players/top`
- [ ] Puedo registrar usuario (se encola)
- [ ] RabbitMQ Management accesible en http://localhost:15672
- [ ] Grafana accesible en http://localhost:3004
- [ ] Prometheus accesible en http://localhost:9090

## 🎉 ¡Listo!

Si todos los puntos del checklist están marcados, tu sistema está funcionando correctamente.

Para más detalles, consulta:
- [Documentación de Arquitectura](docs/ARCHITECTURE.md)
- [Guía de Despliegue](docs/DEPLOYMENT.md)
- [Métricas y Reportes](docs/METRICS.md)

## 📝 Notas Importantes

1. **Puerto MySQL**: Está mapeado a `3307` en lugar de `3306` para evitar conflictos
2. **Puerto Grafana**: Está mapeado a `3004` en lugar de `3001` para evitar conflictos
3. **Backend Nodes**: No exponen puertos externos, se acceden solo a través de NGINX en puerto 80
4. **Comando correcto**: Usa `docker compose` (dos palabras), NO `docker-compose`
