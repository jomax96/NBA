# Métricas y Reportes - NBA Analytics Hub

## Métricas a Recolectar

### 1. Disponibilidad del Sistema

**Métrica**: Porcentaje de tiempo operativo tras caída de BD

**Cálculo**:
```
Disponibilidad = (Tiempo operativo / Tiempo total) * 100
```

**Objetivo**: > 85% de consultas servidas desde caché cuando BD está caída

**Consulta Prometheus**:
```promql
avg_over_time(up{job=~"backend-node.*"}[5m])
```

### 2. Latencia Promedio

**Métrica**: Tiempo de respuesta entre aplicación principal y microservicios

**Consulta Prometheus**:
```promql
histogram_quantile(0.95, 
  rate(http_request_duration_seconds_bucket[5m])
)
```

**Objetivo**: P95 < 500ms

### 3. Tiempo de Recuperación

**Métrica**: Tiempo para procesar escrituras encoladas tras recuperación de BD

**Medición**: 
- Tiempo desde que BD se recupera hasta que la cola está vacía
- Consultar tamaño de cola en RabbitMQ

**Consulta RabbitMQ API**:
```bash
curl -u admin:adminpassword http://localhost:15672/api/queues/user.operations
```

### 4. Consumo de Recursos

**Métricas**:
- CPU % por componente
- RAM (MB) por componente
- Disk I/O

**Consulta Prometheus**:
```promql
# CPU
100 - (avg(rate(container_cpu_usage_seconds_total[5m])) * 100)

# RAM
container_memory_usage_bytes / container_spec_memory_limit_bytes
```

### 5. Requests por Segundo

**Métrica**: RPS bajo carga normal y bajo fallo de BD

**Consulta Prometheus**:
```promql
rate(http_requests_total[1m])
```

**Objetivos**:
- Normal: > 100 RPS
- Bajo fallo: > 50 RPS

### 6. Cache Hit/Miss Ratio

**Métrica**: Ratio de aciertos de caché

**Cálculo**:
```
Hit Ratio = (Cache Hits / Total Requests) * 100
```

**Objetivo**: > 60% hit ratio

### 7. Circuit Breaker State

**Métrica**: Estado del Circuit Breaker (CLOSED/OPEN/HALF_OPEN)

**Endpoint**: `/api/health` retorna `circuitBreaker.state`

**Monitoreo**: Alertar cuando estado = OPEN por > 5 minutos

### 8. Queue Size

**Métrica**: Tamaño de cola RabbitMQ

**Objetivo**: < 1000 mensajes en cola

## Dashboards Grafana

### Dashboard Principal

1. **Disponibilidad General**
   - Uptime de cada servicio
   - Estado de Circuit Breaker
   - Health checks

2. **Performance**
   - Latencia P50, P95, P99
   - Requests por segundo
   - Throughput

3. **Recursos**
   - CPU por servicio
   - RAM por servicio
   - Network I/O

4. **Resiliencia**
   - Cache hit ratio
   - Queue size
   - Failed requests
   - Circuit breaker events

## Alertas Recomendadas

```yaml
# Prometheus Alert Rules
groups:
  - name: nba_analytics
    rules:
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        annotations:
          summary: "High latency detected"
      
      - alert: CircuitBreakerOpen
        expr: circuit_breaker_state{state="OPEN"} == 1
        for: 5m
        annotations:
          summary: "Circuit breaker is OPEN"
      
      - alert: HighQueueSize
        expr: rabbitmq_queue_messages > 1000
        for: 5m
        annotations:
          summary: "RabbitMQ queue size is high"
      
      - alert: LowCacheHitRate
        expr: cache_hit_rate < 0.5
        for: 10m
        annotations:
          summary: "Cache hit rate is below 50%"
```

## Scripts de Medición

### Script de Prueba de Disponibilidad

```bash
#!/bin/bash
# test-availability.sh

# Detener BD
docker-compose stop mysql

# Esperar 10 segundos
sleep 10

# Realizar 100 requests
for i in {1..100}; do
  curl -s http://localhost/api/teams > /dev/null
done

# Verificar cache hits
redis-cli INFO stats | grep keyspace_hits

# Recuperar BD
docker-compose start mysql

echo "Test completed"
```

## Reportes

### Reporte Semanal

1. Disponibilidad: X%
2. Latencia promedio: Xms
3. Picos de tráfico: X RPS
4. Eventos de Circuit Breaker: X veces
5. Tiempo promedio de recuperación: X segundos

