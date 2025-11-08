# NBA Analytics Hub

Plataforma web interactiva para explorar estadísticas históricas y en tiempo real de la NBA con arquitectura distribuida y alta disponibilidad.

## 🏗️ Arquitectura

El sistema está diseñado como una arquitectura distribuida con:

- **3 Nodos de Aplicación Principal** (Node.js + Express)
- **Balanceador de Carga** (NGINX)
- **Bases de Datos**: MySQL (Read-Only, datos NBA) + **MongoDB (SPOF intencional - Users/Favoritos/Alerts)**
- **Mecanismos de Resiliencia**: Redis Cache + RabbitMQ + Circuit Breaker (monitorea MongoDB)
- **Queue Worker**: Procesa escrituras a MongoDB desde RabbitMQ
- **2 Microservicios**: ML Predictions (Python/Flask) + Notifications (Node.js)
- **Monitoreo**: Prometheus + Grafana

## 🚀 Inicio Rápido

### Prerrequisitos

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+ (para desarrollo local)
- Python 3.11+ (para microservicio ML)

### Despliegue con Docker Compose

```bash
# Clonar el repositorio
git clone <repo-url>
cd nba-analytics-hub

# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Verificar salud de servicios
docker-compose ps
```

### Acceso a Servicios

- **Frontend**: http://localhost:80
- **API Backend**: http://localhost:3000
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)
- **Redis Commander**: http://localhost:8081

## 📋 Funcionalidades

### Para Usuarios No Autenticados
- ✅ Consulta de estadísticas de equipos y jugadores
- ✅ Búsqueda y filtrado avanzado de partidos históricos
- ✅ Visualización de rankings y comparativas
- ✅ Consulta de información de árbitros

### Para Usuarios Autenticados
- ✅ Sistema de favoritos (equipos y jugadores)
- ✅ Alertas personalizadas sobre actualizaciones
- ✅ Historial de búsquedas
- ✅ Solicitud de predicciones de partidos

## 🛠️ Tecnologías

### Backend
- Node.js 18 + Express.js
- MySQL 8.0 (datos NBA)
- MongoDB (usuarios)
- Redis 7.x (caché)
- RabbitMQ 3.x (colas)

### Frontend
- React.js 18
- Tailwind CSS
- Chart.js (visualizaciones)

### Microservicios
- **ML Predictions**: Python 3.11 + Flask + scikit-learn
- **Notifications**: Node.js + Bull Queue + NodeMailer

### Infraestructura
- NGINX (balanceador)
- Prometheus + Grafana (monitoreo)
- Docker + Docker Compose

## 🔧 Configuración

### Variables de Entorno

Copia los archivos `.env.example` y configura según tu entorno:

```bash
cp backend/.env.example backend/.env
cp microservices/ml-predictions/.env.example microservices/ml-predictions/.env
cp microservices/notifications/.env.example microservices/notifications/.env
```

## 🧪 Testing

```bash
# Tests unitarios
npm test

# Tests E2E
npm run test:e2e

# CI/CD
# Los tests se ejecutan automáticamente en GitHub Actions
```

## 📊 Métricas y Monitoreo

El sistema incluye monitoreo completo con:
- Disponibilidad del sistema
- Latencia de peticiones
- Consumo de recursos (CPU, RAM)
- Requests por segundo
- Estado de Circuit Breaker
- Cache hit/miss ratio

## 🏛️ Arquitectura de Alta Disponibilidad

### Tolerancia a Fallos de BD

**MongoDB (SPOF Intencional) - Users, Favoritos, Alerts:**
1. **Circuit Breaker monitorea MongoDB**: Detecta fallos y abre circuito
2. **Escrituras**: Encoladas en RabbitMQ (100% preservadas, no se pierden)
3. **Queue Worker**: Procesa escrituras cuando MongoDB recupera
4. **Sistema continúa operando**: Aunque MongoDB esté caído

**MySQL (Read-Only) - Datos NBA:**
1. **Lecturas**: Servidas desde Redis Cache (85% de consultas si MySQL cae)
2. **No afecta escrituras**: MySQL es solo lectura

## 📝 Documentación

- [Diagrama de Arquitectura](docs/architecture.md)
- [Guía de Despliegue](docs/deployment.md)
- [API Documentation](docs/api.md)
- [Métricas y Reportes](docs/metrics.md)

## 👥 Contribución

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es parte de un trabajo académico sobre Sistemas Distribuidos.

