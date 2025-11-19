require('dotenv').config();
const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');
const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
const { ObjectId } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const RABBITMQ_URL = `amqp://${process.env.RABBITMQ_USER || 'admin'}:${process.env.RABBITMQ_PASS || 'adminpassword'}@${process.env.RABBITMQ_HOST || 'localhost'}:5672`;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nba_users';

// Configuración de reintentos
const MAX_RETRIES = 10;
const RETRY_DELAY = 5000; // 5 segundos

let mongoClient = null;
let mongoDb = null;
let rabbitConnection = null;
let rabbitChannel = null;

// Configurar transporter de email
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Helper para esperar
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Inicializar MongoDB con reintentos
 */
async function initMongoDB() {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      console.log(`Attempting to connect to MongoDB... (attempt ${retries + 1}/${MAX_RETRIES})`);
      mongoClient = new MongoClient(MONGODB_URI);
      await mongoClient.connect();
      mongoDb = mongoClient.db('nba_users');
      console.log('✅ MongoDB connected (notifications service)');
      return;
    } catch (error) {
      retries++;
      console.error(`❌ MongoDB connection error (attempt ${retries}/${MAX_RETRIES}):`, error.message);

      if (retries < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
        await sleep(RETRY_DELAY);
      } else {
        console.error('❌ Max retries reached. Could not connect to MongoDB');
      }
    }
  }
}

/**
 * Inicializar RabbitMQ con reintentos
 */
async function initRabbitMQ() {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      console.log(`Attempting to connect to RabbitMQ... (attempt ${retries + 1}/${MAX_RETRIES})`);
      console.log(`RabbitMQ URL: ${RABBITMQ_URL.replace(/:[^:@]+@/, ':****@')}`); // Log URL sin password

      rabbitConnection = await amqp.connect(RABBITMQ_URL);

      rabbitConnection.on('error', (err) => {
        console.error('RabbitMQ Connection Error:', err.message);
      });

      rabbitConnection.on('close', () => {
        console.warn('RabbitMQ connection closed, attempting to reconnect...');
        rabbitConnection = null;
        rabbitChannel = null;
        // Intentar reconectar después de 5 segundos
        setTimeout(() => initRabbitMQ(), RETRY_DELAY);
      });

      rabbitChannel = await rabbitConnection.createChannel();

      // Declarar exchange para notificaciones
      await rabbitChannel.assertExchange('notifications.events', 'topic', { durable: true });

      // Declarar cola
      const queue = 'notifications.queue';
      await rabbitChannel.assertQueue(queue, { durable: true });

      // Binding para eventos de autenticación
      await rabbitChannel.bindQueue(queue, 'notifications.events', 'auth.*');

      console.log('✅ RabbitMQ connected and queue declared');

      // Consumir mensajes
      await rabbitChannel.consume(queue, async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            await processNotification(content);
            rabbitChannel.ack(msg);
          } catch (error) {
            console.error('Error processing notification:', error);
            rabbitChannel.nack(msg, false, false);
          }
        }
      });

      console.log('✅ Started consuming messages from notifications.queue');
      return;

    } catch (error) {
      retries++;
      console.error(`❌ RabbitMQ connection error (attempt ${retries}/${MAX_RETRIES}):`, error.message);

      if (retries < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
        await sleep(RETRY_DELAY);
      } else {
        console.error('❌ Max retries reached. Could not connect to RabbitMQ');
        console.error('⚠️  Service will continue without RabbitMQ. Notifications will not be processed.');
      }
    }
  }
}

async function processNotification(notification) {
  console.log('Processing notification:', notification.type);

  if (!mongoDb) {
    console.warn('MongoDB unavailable, skipping notification');
    return;
  }

  try {
    const { userId, type, data } = notification;

    console.log('Looking for user with ID:', userId, 'Type:', typeof userId);

    // Convertir userId a ObjectId si es necesario
    let userQuery;
    try {
      // Intentar convertir a ObjectId si es un string válido
      if (typeof userId === 'string' && ObjectId.isValid(userId)) {
        userQuery = { _id: new ObjectId(userId) };
        console.log('Using ObjectId query:', userQuery);
      } else if (userId instanceof ObjectId) {
        userQuery = { _id: userId };
        console.log('Already an ObjectId');
      } else {
        // Si no es un ObjectId válido, buscar por string
        userQuery = { _id: userId };
        console.log('Using string query:', userQuery);
      }
    } catch (error) {
      console.error('Error converting userId to ObjectId:', error);
      userQuery = { _id: userId };
    }

    // Obtener usuario
    const user = await mongoDb.collection('users').findOne(userQuery);

    if (!user) {
      console.warn('User not found with query:', userQuery);
      // Intentar buscar por email como fallback si está en data
      if (data && data.email) {
        console.log('Trying to find user by email:', data.email);
        const userByEmail = await mongoDb.collection('users').findOne({ email: data.email });
        if (userByEmail) {
          console.log('Found user by email:', userByEmail.email);
          return await sendNotificationEmail(userByEmail, type, data);
        }
      }
      console.warn('User not found and no email fallback available');
      return;
    }

    if (!user.email) {
      console.warn('User found but has no email:', userId);
      return;
    }

    console.log('✅ User found:', user.email);
    await sendNotificationEmail(user, type, data);

  } catch (error) {
    console.error('Error processing notification:', error);
    throw error;
  }
}

/**
 * Función auxiliar para enviar email de notificación
 */
async function sendNotificationEmail(user, type, data) {
  let emailSubject = '';
  let emailBody = '';
  let emailHtml = '';

  switch (type) {
    case 'auth.register':
      emailSubject = '¡Bienvenido a NBA Analytics Hub!';
      emailBody = `Hola ${user.name || user.email},\n\n¡Gracias por registrarte en NBA Analytics Hub!\n\nTu cuenta ha sido creada exitosamente. Ahora puedes acceder a todas las funcionalidades de nuestra plataforma:\n\n- Analíticas avanzadas de equipos y jugadores\n- Estadísticas en tiempo real\n- Predicciones y análisis de partidos\n- Gestión de favoritos personalizada\n\n¡Disfruta explorando el mundo de la NBA!\n\nSaludos,\nEquipo de NBA Analytics Hub`;
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1d428a;">¡Bienvenido a NBA Analytics Hub!</h2>
          <p>Hola <strong>${user.name || user.email}</strong>,</p>
          <p>¡Gracias por registrarte en NBA Analytics Hub!</p>
          <p>Tu cuenta ha sido creada exitosamente. Ahora puedes acceder a todas las funcionalidades de nuestra plataforma:</p>
          <ul>
            <li>📊 Analíticas avanzadas de equipos y jugadores</li>
            <li>📈 Estadísticas en tiempo real</li>
            <li>🏀 Predicciones y análisis de partidos</li>
            <li>⭐ Gestión de favoritos personalizada</li>
          </ul>
          <p>¡Disfruta explorando el mundo de la NBA!</p>
          <p style="margin-top: 30px;">Saludos,<br><strong>Equipo de NBA Analytics Hub</strong></p>
        </div>
      `;
      break;

    case 'auth.login':
      emailSubject = 'Inicio de sesión detectado en NBA Analytics Hub';
      emailBody = `Hola ${user.name || user.email},\n\nSe ha detectado un nuevo inicio de sesión en tu cuenta de NBA Analytics Hub.\n\nDetalles:\n- Fecha y hora: ${new Date().toLocaleString('es-ES', { timeZone: data.timezone || 'UTC' })}\n- Proveedor: ${data.provider === 'google' ? 'Google OAuth' : 'Email/Password'}\n${data.ip ? `- IP: ${data.ip}` : ''}\n${data.userAgent ? `- Navegador: ${data.userAgent}` : ''}\n\nSi no fuiste tú quien inició sesión, por favor cambia tu contraseña inmediatamente y contacta con nuestro equipo de soporte.\n\nSaludos,\nEquipo de NBA Analytics Hub`;
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1d428a;">Inicio de sesión detectado</h2>
          <p>Hola <strong>${user.name || user.email}</strong>,</p>
          <p>Se ha detectado un nuevo inicio de sesión en tu cuenta de NBA Analytics Hub.</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Detalles del inicio de sesión:</h3>
            <p style="margin: 5px 0;"><strong>📅 Fecha y hora:</strong> ${new Date().toLocaleString('es-ES', { timeZone: data.timezone || 'UTC' })}</p>
            <p style="margin: 5px 0;"><strong>🔐 Proveedor:</strong> ${data.provider === 'google' ? 'Google OAuth' : 'Email/Password'}</p>
            ${data.ip ? `<p style="margin: 5px 0;"><strong>🌐 IP:</strong> ${data.ip}</p>` : ''}
            ${data.userAgent ? `<p style="margin: 5px 0;"><strong>💻 Navegador:</strong> ${data.userAgent}</p>` : ''}
          </div>
          <p style="color: #d32f2f; font-weight: bold;">⚠️ Si no fuiste tú quien inició sesión, por favor cambia tu contraseña inmediatamente y contacta con nuestro equipo de soporte.</p>
          <p style="margin-top: 30px;">Saludos,<br><strong>Equipo de NBA Analytics Hub</strong></p>
        </div>
      `;
      break;

    default:
      emailSubject = 'Notificación de NBA Analytics Hub';
      emailBody = JSON.stringify(data);
      emailHtml = `<p>${JSON.stringify(data)}</p>`;
  }

  // Enviar email (simulado si no hay configuración SMTP)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await emailTransporter.sendMail({
        from: `"NBA Analytics Hub" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: emailSubject,
        text: emailBody,
        html: emailHtml
      });
      console.log(`✅ Email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Error sending email:', emailError.message);
      // No lanzar error - continuar para guardar en BD
    }
  } else {
    console.log(`[SIMULATED] Email would be sent to ${user.email}`);
    console.log(`Subject: ${emailSubject}`);
  }

  // Guardar notificación en BD
  try {
    await mongoDb.collection('notifications').insertOne({
      userId: user._id,
      type,
      data,
      sentAt: new Date(),
      channel: 'email',
      status: 'sent'
    });
    console.log('✅ Notification saved to database');
  } catch (dbError) {
    console.error('Error saving notification to database:', dbError.message);
  }
}

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'notifications',
    mongo: mongoDb ? 'connected' : 'disconnected',
    rabbitmq: rabbitChannel ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Exportar app para tests
module.exports = app;

// Inicialización
async function start() {
  console.log('🚀 Starting Notifications Service...');
  console.log('Environment:', {
    PORT,
    RABBITMQ_HOST: process.env.RABBITMQ_HOST || 'localhost',
    RABBITMQ_USER: process.env.RABBITMQ_USER || 'admin',
    MONGODB_URI: MONGODB_URI.replace(/:[^:@]+@/, ':****@') // Ocultar password
  });

  // Inicializar conexiones en paralelo
  await Promise.all([
    initMongoDB(),
    initRabbitMQ()
  ]);

  // Iniciar servidor incluso si las conexiones fallan
  app.listen(PORT, () => {
    console.log(`🚀 Notifications service running on port ${PORT}`);
  });
}

start();

// Manejo de señales
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (rabbitConnection) {
    try {
      await rabbitConnection.close();
      console.log('RabbitMQ connection closed');
    } catch (error) {
      console.error('Error closing RabbitMQ:', error);
    }
  }
  if (mongoClient) {
    try {
      await mongoClient.close();
      console.log('MongoDB connection closed');
    } catch (error) {
      console.error('Error closing MongoDB:', error);
    }
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (rabbitConnection) {
    try {
      await rabbitConnection.close();
    } catch (error) {
      console.error('Error closing RabbitMQ:', error);
    }
  }
  if (mongoClient) {
    try {
      await mongoClient.close();
    } catch (error) {
      console.error('Error closing MongoDB:', error);
    }
  }
  process.exit(0);
});