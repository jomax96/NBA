const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;
const QUEUE_NAME = process.env.RABBITMQ_QUEUE || 'user.operations';

/**
 * Inicializa conexión a RabbitMQ
 */
async function initRabbitMQ() {
  try {
    const url = `amqp://${process.env.RABBITMQ_USER || 'admin'}:${process.env.RABBITMQ_PASS || 'adminpassword'}@${process.env.RABBITMQ_HOST || 'localhost'}:5672`;
    
    connection = await amqp.connect(url);
    
    connection.on('error', (err) => {
      logger.error('RabbitMQ Connection Error:', err);
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
    });

    channel = await connection.createChannel();
    
    // Declarar cola persistente
    await channel.assertQueue(QUEUE_NAME, {
      durable: true // Sobrevive reinicios del broker
    });

    logger.info('✅ RabbitMQ connected and queue declared');
    return { connection, channel };
  } catch (error) {
    logger.error('❌ RabbitMQ connection error:', error.message);
    // RabbitMQ no es crítico para inicio, continuamos
    return null;
  }
}

/**
 * Publica mensaje en cola
 */
async function publishMessage(queueName, message, options = {}) {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    const sent = channel.sendToQueue(
      queueName || QUEUE_NAME,
      messageBuffer,
      {
        persistent: true, // Mensaje duradero
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
 * Consume mensajes de cola
 */
async function consumeMessages(queueName, callback) {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    await channel.consume(queueName || QUEUE_NAME, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await callback(content);
          channel.ack(msg);
        } catch (error) {
          logger.error('Error processing message:', error);
          // Rechazar mensaje y enviar a DLQ
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
    // Verificar que la conexión esté activa
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

