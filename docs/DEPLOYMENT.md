# Guía de Despliegue - NBA Analytics Hub

## Requisitos Previos

- Docker 20.10+
- Docker Compose 2.0+
- 8GB RAM mínimo
- 20GB espacio en disco

## Despliegue Local

### 1. Clonar Repositorio

```bash
git clone <repo-url>
cd nba-analytics-hub
```

### 2. Configurar Variables de Entorno

Copia y configura los archivos `.env.example`:

```bash
cp backend/.env.example backend/.env
# Edita backend/.env con tus configuraciones
```

### 3. Iniciar Servicios

```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Verificar estado
docker-compose ps
```

### 4. Verificar Salud

```bash
# Health check de backend
curl http://localhost:3001/health

# Health check de NGINX
curl http://localhost/health

# Health check de ML Service
curl http://localhost:5000/health

# Health check de Notifications
curl http://localhost:4000/health
```

### 5. Acceder a Servicios

- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:3001 (o través de NGINX en :80/api)
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **RabbitMQ Management**: http://localhost:15672 (admin/adminpassword)

## Prueba de Tolerancia a Fallos

### Simular Caída de Base de Datos

```bash
# Detener MySQL
docker-compose stop mysql

# Verificar que el sistema sigue respondiendo
curl http://localhost/api/teams
curl http://localhost/api/health

# Las escrituras deberían encolarse en RabbitMQ
curl -X POST http://localhost/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'

# Verificar cola en RabbitMQ Management
# http://localhost:15672

# Recuperar MySQL
docker-compose start mysql

# Verificar que las operaciones se procesan
# (deberían procesarse automáticamente en ~10 segundos)
```

## Monitoreo

### Métricas en Prometheus

Accede a http://localhost:9090 y consulta:

- `http_requests_total` - Total de requests
- `http_request_duration_seconds` - Latencia
- `circuit_breaker_state` - Estado del Circuit Breaker
- `cache_hit_rate` - Ratio de cache hits

### Dashboards en Grafana

1. Accede a http://localhost:3001
2. Login: admin/admin
3. Importa dashboards desde `monitoring/grafana/dashboards/`

## Escalado

### Agregar Más Nodos de Backend

Edita `docker-compose.yml` y agrega:

```yaml
backend-node4:
  # ... misma configuración que node1-3
```

Luego actualiza `nginx/nginx.conf` para incluir el nuevo nodo.

### Escalar Microservicios

```bash
docker-compose up -d --scale ml-predictions=2
docker-compose up -d --scale notifications=3
```

## Troubleshooting

### Verificar Logs

```bash
# Todos los logs
docker-compose logs

# Logs específicos
docker-compose logs backend-node1
docker-compose logs mysql
docker-compose logs redis
```

### Reiniciar Servicio

```bash
docker-compose restart backend-node1
```

### Reconstruir Imágenes

```bash
docker-compose build --no-cache
docker-compose up -d
```

## Producción

Para producción, considera:

1. Usar secrets management (Docker Secrets, Kubernetes Secrets)
2. Configurar HTTPS con certificados SSL
3. Configurar backup automático de bases de datos
4. Usar orquestación (Kubernetes, Docker Swarm)
5. Configurar alertas en Prometheus/Grafana
6. Implementar rate limiting más estricto
7. Configurar CORS apropiadamente

