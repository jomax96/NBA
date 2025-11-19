const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;
let isConnecting = false;
let reconnectTimer = null;

const QUEUE_NAME = process.env.RABBITMQ_QUEUE || 'user.operations';
const MAX_RETRIES = 10;
const RETRY_DELAY = 5000; // 5 segundos
const RECONNECT_DELAY = 10000; // 10 segundos para reconexión automática

/**
 * Función helper para esperar
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Limpia conexión existente
 */
async function cleanup() {
  try {
    if (channel) {
      await channel.close().catch(() => { });
      channel = null;
    }
    if (connection) {
      await connection.close().catch(() => { });
      connection = null;
    }
  } catch (error) {
    logger.debug('Cleanup error (ignoring):', error.message);
  }
}

/**
 * Inicializa conexión a RabbitMQ con reintentos
 */
async function initRabbitMQ() {
  // Evitar múltiples intentos de conexión simultáneos
  if (isConnecting) {
    logger.debug('Already attempting to connect to RabbitMQ');
    return null;
  }

  isConnecting = true;
  const url = `amqp://${process.env.RABBITMQ_USER || 'admin'}:${process.env.RABBITMQ_PASS || 'adminpassword'}@${process.env.RABBITMQ_HOST || 'localhost'}:5672`;

  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      logger.info(`Attempting to connect to RabbitMQ... (attempt ${retries + 1}/${MAX_RETRIES})`);

      // Limpiar conexión anterior si existe
      await cleanup();

      connection = await amqp.connect(url);

      // Manejar errores de conexión
      connection.on('error', (err) => {
        logger.error('RabbitMQ Connection Error:', err.message);
        // No intentar reconectar aquí, el evento 'close' lo manejará
      });

      // Manejar cierre de conexión
      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        channel = null;
        connection = null;

        // Intentar reconectar automáticamente después de un delay
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            isConnecting = false;
            logger.info('Attempting automatic reconnection to RabbitMQ...');
            initRabbitMQ().catch(err =>
              logger.error('Auto-reconnection failed:', err.message)
            );
          }, RECONNECT_DELAY);
        }
      });

      // Crear canal
      channel = await connection.createChannel();

      // Configurar prefetch para el consumidor
      await channel.prefetch(1);

      // Declarar cola persistente
      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: {
          'x-message-ttl': 86400000, // 24 horas
          'x-max-length': 10000 // Máximo 10k mensajes
        }
      });

      // Declarar exchange para notificaciones (opcional)
      await channel.assertExchange('notifications.events', 'topic', {
        durable: true
      });

      // Declarar cola de notificaciones
      await channel.assertQueue('notifications.queue', {
        durable: true
      });

      logger.info('✅ RabbitMQ connected and queue declared');
      isConnecting = false;
      return { connection, channel };

    } catch (error) {
      retries++;
      logger.warn(`RabbitMQ connection attempt ${retries} failed: ${error.message}`);

      if (retries < MAX_RETRIES) {
        logger.info(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
        await sleep(RETRY_DELAY);
      } else {
        logger.error('❌ Max retries reached. Could not connect to RabbitMQ');
        isConnecting = false;

        // Programar reintento después de un tiempo más largo
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            isConnecting = false;
            logger.info('Retrying RabbitMQ connection after max retries timeout...');
            initRabbitMQ().catch(err =>
              logger.error('Delayed reconnection failed:', err.message)
            );
          }, 30000); // 30 segundos
        }

        return null;
      }
    }
  }
}

/**
 * Obtiene canal actual o intenta reconectar
 */
async function getChannel() {
  if (channel) {
    return channel;
  }

  logger.info('Channel not available, attempting to reconnect...');
  await initRabbitMQ();
  return channel;
}

/**
 * Publica mensaje en cola con reintentos
 */
async function publishMessage(queueName, message, options = {}) {
  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      const currentChannel = await getChannel();

      if (!currentChannel) {
        throw new Error('RabbitMQ channel not available');
      }

      const messageBuffer = Buffer.from(JSON.stringify(message));

      const sent = currentChannel.sendToQueue(
        queueName || QUEUE_NAME,
        messageBuffer,
        {
          persistent: true,
          ...options
        }
      );

      if (sent) {
        logger.info(`Message published to queue: ${queueName || QUEUE_NAME}`, {
          messageType: message.type,
          attempt: attempt + 1
        });
        return true;
      } else {
        logger.warn('Message was not sent, channel buffer full');

        // Esperar antes de reintentar
        await sleep(1000);
        attempt++;
        continue;
      }
    } catch (error) {
      attempt++;
      logger.error(`Error publishing message (attempt ${attempt}/${maxAttempts}):`, error.message);

      if (attempt < maxAttempts) {
        // Esperar antes de reintentar
        await sleep(2000);
        // Invalidar canal para forzar reconexión
        channel = null;
      } else {
        throw new Error(`Failed to publish message after ${maxAttempts} attempts: ${error.message}`);
      }
    }
  }

  throw new Error('Failed to publish message');
}

/**
 * Consume mensajes de cola con reintentos
 */
async function consumeMessages(queueName, callback) {
  const maxRetries = 5;
  let retryCount = 0;

  async function startConsuming() {
    try {
      const currentChannel = await getChannel();

      if (!currentChannel) {
        throw new Error('RabbitMQ channel not available for consuming');
      }

      await currentChannel.consume(queueName || QUEUE_NAME, async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            logger.info('Processing message:', {
              type: content.type,
              userId: content.userId
            });

            await callback(content);
            currentChannel.ack(msg);
            logger.debug('Message acknowledged successfully');

          } catch (error) {
            logger.error('Error processing message:', error);

            // Si el error es de MongoDB, reencolar para reintentar
            if (error.message.includes('MongoDB') || error.message.includes('unavailable')) {
              logger.warn('MongoDB unavailable, message will be requeued');
              currentChannel.nack(msg, false, true); // Requeue
            } else {
              // Error fatal, mover a DLQ o descartar
              logger.error('Fatal error processing message, discarding:', error);
              currentChannel.nack(msg, false, false); // No requeue
            }
          }
        }
      }, {
        noAck: false
      });

      logger.info(`✅ Started consuming from queue: ${queueName || QUEUE_NAME}`);
      retryCount = 0; // Reset retry count on success

    } catch (error) {
      logger.error('Error consuming messages:', error);
      retryCount++;

      if (retryCount < maxRetries) {
        logger.info(`Retrying consumer setup in 5 seconds... (${retryCount}/${maxRetries})`);
        await sleep(5000);
        await startConsuming();
      } else {
        logger.error('Max consumer retries reached, giving up');
        throw error;
      }
    }
  }

  return startConsuming();
}

/**
 * Verifica salud de RabbitMQ
 */
async function checkRabbitMQHealth() {
  try {
    if (!connection || !channel) return false;

    // Verificar que la conexión esté activa
    if (!connection.connection || connection.connection.closing) {
      return false;
    }

    // Intentar una operación simple para verificar
    await channel.checkQueue(QUEUE_NAME);
    return true;
  } catch (error) {
    logger.debug('RabbitMQ health check failed:', error.message);
    return false;
  }
}

/**
 * Cierra conexión RabbitMQ
 */
async function closeRabbitMQ() {
  try {
    // Cancelar timer de reconexión si existe
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    await cleanup();
    logger.info('RabbitMQ connection closed');
  } catch (error) {
    logger.error('Error closing RabbitMQ:', error);
  }
}

/**
 * Publica mensaje en exchange de notificaciones
 */
async function publishNotification(routingKey, message) {
  try {
    const currentChannel = await getChannel();

    if (!currentChannel) {
      logger.warn('Channel not available for publishing notification');
      return false;
    }

    await currentChannel.assertExchange('notifications.events', 'topic', {
      durable: true
    });

    const messageBuffer = Buffer.from(JSON.stringify(message));

    const sent = currentChannel.publish(
      'notifications.events',
      routingKey,
      messageBuffer,
      { persistent: true }
    );

    if (sent) {
      logger.info(`Notification published with routing key: ${routingKey}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error publishing notification:', error);
    return false;
  }
}

/**
 * Obtiene estadísticas de la cola
 */
async function getQueueStats() {
  try {
    if (!channel) return null;

    const queueInfo = await channel.checkQueue(QUEUE_NAME);
    return {
      messageCount: queueInfo.messageCount,
      consumerCount: queueInfo.consumerCount
    };
  } catch (error) {
    logger.error('Error getting queue stats:', error);
    return null;
  }
}

module.exports = {
  initRabbitMQ,
  publishMessage,
  consumeMessages,
  checkRabbitMQHealth,
  closeRabbitMQ,
  publishNotification,
  getQueueStats,
  QUEUE_NAME,
  getChannel
};