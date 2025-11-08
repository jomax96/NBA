#!/bin/bash

# Script para probar tolerancia a fallos
# Simula caída de BD y verifica que el sistema sigue operativo

echo "=== NBA Analytics Hub - Failure Test ==="
echo ""

# 1. Verificar estado inicial
echo "1. Verificando estado inicial..."
curl -s http://localhost/api/health | jq '.'
echo ""

# 2. Detener MySQL
echo "2. Deteniendo MySQL (simulando fallo)..."
docker-compose stop mysql
sleep 5

# 3. Verificar que el sistema sigue respondiendo
echo "3. Verificando que el sistema sigue respondiendo..."
echo "Health check:"
curl -s http://localhost/api/health | jq '.'
echo ""

echo "Intentando leer equipos (debería usar caché):"
curl -s http://localhost/api/teams | jq '.source'
echo ""

# 4. Intentar escritura (debería encolarse)
echo "4. Intentando escritura (debería encolarse)..."
curl -s -X POST http://localhost/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test'$(date +%s)'@example.com","password":"test123","name":"Test User"}' | jq '.'
echo ""

# 5. Verificar cola RabbitMQ
echo "5. Verificando tamaño de cola RabbitMQ..."
QUEUE_SIZE=$(curl -s -u admin:adminpassword http://localhost:15672/api/queues/%2F/user.operations | jq '.messages')
echo "Mensajes en cola: $QUEUE_SIZE"
echo ""

# 6. Recuperar MySQL
echo "6. Recuperando MySQL..."
docker-compose start mysql
echo "Esperando a que MySQL esté listo..."
sleep 10

# 7. Verificar que las operaciones se procesan
echo "7. Verificando procesamiento de cola..."
sleep 15
QUEUE_SIZE_AFTER=$(curl -s -u admin:adminpassword http://localhost:15672/api/queues/%2F/user.operations | jq '.messages')
echo "Mensajes en cola después: $QUEUE_SIZE_AFTER"
echo ""

# 8. Verificar estado final
echo "8. Verificando estado final..."
curl -s http://localhost/api/health | jq '.'
echo ""

echo "=== Test completado ==="

