const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;
const QUEUE_NAME = process.env.RABBITMQ_QUEUE || 'user.operations';

// Configuración de reintentos
const MAX_RETRIES = 10;
const RETRY_DELAY = 5000; // 5 segundos

/**
 * Función helper para esperar
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Inicializa conexión a RabbitMQ con reintentos
 */
async function initRabbitMQ() {
  const url = `amqp://${process.env.RABBITMQ_USER || 'admin'}:${process.env.RABBITMQ_PASS || 'adminpassword'}@${process.env.RABBITMQ_HOST || 'localhost'}:5672`;

  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      logger.info(`Attempting to connect to RabbitMQ... (attempt ${retries + 1}/${MAX_RETRIES})`);

      connection = await amqp.connect(url);

      connection.on('error', (err) => {
        logger.error('RabbitMQ Connection Error:', err);
      });

      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        // Intentar reconectar automáticamente
        setTimeout(() => initRabbitMQ(), RETRY_DELAY);
      });

      channel = await connection.createChannel();

      // Declarar cola persistente
      await channel.assertQueue(QUEUE_NAME, {
        durable: true
      });

      logger.info('✅ RabbitMQ connected and queue declared');
      return { connection, channel };

    } catch (error) {
      retries++;
      logger.warn(`RabbitMQ connection attempt ${retries} failed: ${error.message}`);

      if (retries < MAX_RETRIES) {
        logger.info(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
        await sleep(RETRY_DELAY);
      } else {
        logger.error('❌ Max retries reached. Could not connect to RabbitMQ');
        return null;
      }
    }
  }
}

/**
 * Publica mensaje en cola con reintentos
 */
async function publishMessage(queueName, message, options = {}) {
  try {
    // Si no hay canal, intentar reconectar
    if (!channel) {
      logger.info('Channel not available, attempting to reconnect...');
      await initRabbitMQ();

      if (!channel) {
        throw new Error('Unable to establish RabbitMQ connection');
      }
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));

    const sent = channel.sendToQueue(
      queueName || QUEUE_NAME,
      messageBuffer,
      {
        persistent: true,
        ...options
      }
    );

    if (sent) {
      logger.info(`Message published to queue: ${queueName || QUEUE_NAME}`, { messageType: message.type });
      return true;
    } else {
      logger.warn('Message was not sent, channel buffer full');
      return false;
    }
  } catch (error) {
    logger.error('Error publishing message:', error);
    throw error;
  }
}

/**
 * Consume mensajes de cola con reintentos
 */
async function consumeMessages(queueName, callback) {
  try {
    // Si no hay canal, intentar reconectar
    if (!channel) {
      logger.info('Channel not available for consuming, attempting to reconnect...');
      await initRabbitMQ();

      if (!channel) {
        throw new Error('Unable to establish RabbitMQ connection for consuming');
      }
    }

    await channel.consume(queueName || QUEUE_NAME, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await callback(content);
          channel.ack(msg);
        } catch (error) {
          logger.error('Error processing message:', error);
          channel.nack(msg, false, false);
        }
      }
    }, {
      noAck: false
    });

    logger.info(`Started consuming from queue: ${queueName || QUEUE_NAME}`);
  } catch (error) {
    logger.error('Error consuming messages:', error);
    throw error;
  }
}

/**
 * Verifica salud de RabbitMQ
 */
async function checkRabbitMQHealth() {
  try {
    if (!connection || !channel) return false;
    return connection.connection && !connection.connection.closing;
  } catch (error) {
    return false;
  }
}

/**
 * Cierra conexión RabbitMQ
 */
async function closeRabbitMQ() {
  try {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
    logger.info('RabbitMQ connection closed');
  } catch (error) {
    logger.error('Error closing RabbitMQ:', error);
  }
}

module.exports = {
  initRabbitMQ,
  publishMessage,
  consumeMessages,
  checkRabbitMQHealth,
  closeRabbitMQ,
  QUEUE_NAME
};