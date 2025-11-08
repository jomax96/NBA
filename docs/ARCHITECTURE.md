# Arquitectura del Sistema - NBA Analytics Hub

## Diagrama de Arquitectura

```
                    ┌─────────────────┐
                    │   Usuarios      │
                    │ (Web/Mobile)    │
                    └────────┬────────┘
                             │ HTTP/HTTPS
                    ┌────────▼────────┐
                    │   NGINX LB      │
                    │ Round Robin +   │
                    │ Health Checks   │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │ Backend   │    │ Backend   │    │ Backend   │
    │ Node 1    │    │ Node 2    │    │ Node 3    │
    │ :3001     │    │ :3002     │    │ :3003     │
    │Express.js │    │Express.js │    │Express.js │
    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
          │                │                  │
          │                │                  │
    ┌─────┴────────────────┼────────────────┴─────┐
    │                      │                        │
    │  ┌───────────────────┴────────────────────┐  │
    │  │        API REST + Pub/Sub Events       │  │
    │  └───────────────────┬────────────────────┘  │
    │                      │                        │
    │  ┌───────────────────┴────────────────────┐  │
    │  │    Redis Cache (Lecturas/Cacheo)        │  │
    │  └───────────────────┬────────────────────┘  │
    │                      │                        │
    │  ┌───────────────────┴────────────────────┐  │
    │  │  RabbitMQ (Escrituras asíncronas)       │  │
    │  └───────────────────┬────────────────────┘  │
    │                      │                        │
    │  ┌───────────────────┴────────────────────┐  │
    │  │  Circuit Breaker (Supervisa MongoDB)   │  │
    │  └───────────────────┬────────────────────┘  │
    │                      │                        │
    └──────────────────────┼────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐  ┌──────▼──────┐  ┌─────▼─────┐
    │   MySQL   │  │   MongoDB   │  │  Redis    │
    │Read-Only  │  │  SPOF       │  │  Cache    │
    │Datos NBA  │  │Intencional  │  │           │
    │           │  │Users/Favs   │  │           │
    └───────────┘  └──────┬──────┘  └───────────┘
                           │
                    ┌──────▼──────┐
                    │  RabbitMQ   │
                    │   Queue     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │Queue Worker │
                    │Procesa escrit│
                    │a MongoDB    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   MongoDB   │
                    │  (Persiste) │
                    └─────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐  ┌──────▼──────┐
    │    ML     │  │Notifications│
    │Predictions│  │  Service    │
    │Python+Flask│  │  Node.js    │
    │  :5000    │  │   :4000     │
    └───────────┘  └──────────────┘
```

## Componentes Principales

### 1. NGINX Load Balancer

- **Función**: Distribuye peticiones entre 3 nodos backend
- **Algoritmo**: Round Robin + Health Checks
- **Health Checks**: Cada 5 segundos
- **Failover**: Automático si nodo no responde en 2 segundos

### 2. Aplicación Principal (3 Nodos)

**Backend Node.js + Express**
- Lógica de negocio completa
- APIs REST para equipos, jugadores, partidos
- Autenticación JWT
- **Circuit Breaker para MongoDB (SPOF)** - Monitorea MongoDB
- Circuit Breaker para MySQL (Read-Only, menos crítico)
- Integración con Redis Cache
- Integración con RabbitMQ

**Características**:
- Stateless (puede escalar horizontalmente)
- Health checks internos
- Logging estructurado

### 3. Base de Datos MySQL (Read-Only)

**Propósito**: Almacenar datos NBA (solo lectura)
- Equipos, jugadores, partidos, estadísticas
- Optimizado con índices
- Connection pooling
- **Read-Only**: No se escriben datos aquí

**Estrategia de Resiliencia**:
- Redis Cache sirve lecturas cuando BD cae
- Circuit Breaker opcional (menos crítico que MongoDB)

### 4. MongoDB (SPOF Intencional)

**Propósito**: Almacenar usuarios y datos no relacionales
- **SPOF Intencional**: Punto único de fallo diseñado intencionalmente
- Usuarios, favoritos, alertas
- Historial de búsquedas
- Notificaciones

**Estrategia de Resiliencia**:
- **Circuit Breaker monitorea MongoDB** (no MySQL)
- RabbitMQ encola todas las escrituras
- Queue Worker procesa escrituras cuando MongoDB recupera
- Sistema continúa operando aunque MongoDB esté caído

### 5. Redis Cache

**Datos Cacheados**:
- `teams:all` - Lista completa de equipos (TTL: 30 min)
- `players:top100` - Top 100 jugadores (TTL: 5 min)
- `games:recent:500` - Últimos 500 partidos (TTL: 5 min)
- `team:stats:{id}` - Estadísticas de equipo (TTL: 5 min)
- `player:stats:{id}` - Estadísticas de jugador (TTL: 5 min)
- Stats + Sesiones (TTL: 5-30 min)

**Estrategia**:
- Cache-aside pattern
- Invalidación automática por TTL
- Invalidación manual en actualizaciones

### 6. RabbitMQ

**Colas**:
- `user.operations` - Operaciones de usuario para MongoDB (registro, favoritos, alertas)
- **Solo escrituras a MongoDB se encolan** (MySQL es Read-Only)

**Características**:
- Colas persistentes
- Mensajes duraderos
- Dead Letter Queue
- Queue Worker procesa escrituras a MongoDB cada 10 segundos

### 7. Queue Worker

**Propósito**: Procesa escrituras a MongoDB desde RabbitMQ
- Consume cola `user.operations`
- Persiste datos en MongoDB cuando está disponible
- Usa Circuit Breaker para detectar disponibilidad de MongoDB
- Reintentos automáticos

### 8. Microservicio ML Predictions

**Stack**: Python 3.11 + Flask + scikit-learn + SQLite local

**Funcionalidad**:
- Predice ganador de partidos
- Estima marcador
- Calcula probabilidades
- Dataset local (SQLite)

**Comunicación**: REST API

### 9. Microservicio Notifications

**Stack**: Node.js + Bull Queue + NodeMailer

**Funcionalidad**:
- Procesa alertas de usuarios
- Envía emails
- Registra notificaciones
- Lee usuarios desde MongoDB

**Comunicación**: Event-driven vía RabbitMQ

## Flujos Principales

### Flujo de Lectura NBA (MySQL Read-Only)

1. Cliente → NGINX
2. NGINX → Backend Node (round-robin)
3. Backend verifica Redis Cache
4. Si no está en caché → MySQL (Read-Only)
5. Guarda resultado en Redis
6. Retorna respuesta

### Flujo de Lectura (MySQL Caída)

1. Cliente → NGINX → Backend Node
2. Backend verifica Redis Cache
3. Si está en caché → Retorna
4. Si no está en caché → Retorna datos vacíos o error controlado

### Flujo de Escritura (MongoDB - SPOF)

1. Cliente → NGINX → Backend Node
2. Backend publica mensaje en RabbitMQ (cola persistente)
3. Retorna confirmación inmediata al cliente ("operación en proceso")
4. **Queue Worker** consume cola cuando MongoDB está disponible
5. Circuit Breaker monitorea MongoDB y permite/protege escrituras
6. Guarda en MongoDB (Users, Favoritos, Alerts)

### Flujo de Lectura Usuarios (MongoDB)

1. Cliente → NGINX → Backend Node
2. Backend usa Circuit Breaker para MongoDB
3. Si MongoDB disponible → Lee datos
4. Si MongoDB caído → Circuit Breaker OPEN, retorna error controlado
5. Escrituras se encolan en RabbitMQ

### Flujo de Predicción

1. Cliente solicita predicción
2. Backend llama a ML Service (timeout: 5s)
3. ML Service consulta MySQL (Read-Only) para estadísticas
4. Retorna predicción
5. Si ML Service caído → Backend retorna fallback

## Tolerancia a Fallos

### Circuit Breaker Pattern para MongoDB (SPOF Intencional)

**Estados**:
- **CLOSED**: Normal, MongoDB disponible
- **OPEN**: MongoDB caída, escrituras encoladas en RabbitMQ
- **HALF_OPEN**: Probando recuperación cada 30 segundos

**Transiciones**:
- CLOSED → OPEN: 3 fallos consecutivos detectados
- OPEN → HALF_OPEN: Cada 30 segundos intenta verificar recuperación
- HALF_OPEN → CLOSED: Si MongoDB responde correctamente
- HALF_OPEN → OPEN: Si MongoDB sigue caído

**Circuit Breaker para MySQL (Read-Only, menos crítico)**:
- Similar pero con umbral más alto (5 fallos)
- Menos crítico porque MySQL solo se lee

### Disponibilidad Esperada

- **MongoDB caída (SPOF)**: 
  - Sistema sigue operando (lecturas desde caché)
  - Escrituras 100% encoladas en RabbitMQ (no se pierden)
  - Queue Worker procesa cuando MongoDB recupera
- **MySQL caída (Read-Only)**:
  - 85% de consultas desde caché Redis
  - No afecta escrituras (solo lectura)

## Escalabilidad

### Horizontal

- Agregar más nodos backend (editar docker-compose.yml)
- Escalar microservicios independientemente
- Redis cluster para caché distribuido
- Múltiples Queue Workers

### Vertical

- Aumentar recursos de contenedores
- Optimizar queries MySQL
- Ajustar TTL de caché

## Seguridad

- JWT para autenticación
- Rate limiting en API
- Helmet.js para headers de seguridad
- CORS configurado
- Secrets en variables de entorno

## Monitoreo

- Prometheus recolecta métricas
- Grafana visualiza dashboards
- Health checks en cada servicio
- Logs centralizados (Winston)
- Circuit Breaker state expuesto en `/health`
