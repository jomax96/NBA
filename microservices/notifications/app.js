require('dotenv').config();
const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');
const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const RABBITMQ_URL = `amqp://${process.env.RABBITMQ_USER || 'admin'}:${process.env.RABBITMQ_PASS || 'adminpassword'}@${process.env.RABBITMQ_HOST || 'localhost'}:5672`;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nba_users';

let mongoClient = null;
let mongoDb = null;
let rabbitConnection = null;
let rabbitChannel = null;

// Configurar transporter de email (simulado)
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function initMongoDB() {
  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    mongoDb = mongoClient.db('nba_users');
    console.log('✅ MongoDB connected (notifications service)');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
  }
}

async function initRabbitMQ() {
  try {
    rabbitConnection = await amqp.connect(RABBITMQ_URL);
    rabbitChannel = await rabbitConnection.createChannel();
    
    // Declarar exchange para notificaciones
    await rabbitChannel.assertExchange('notifications.events', 'topic', { durable: true });
    
    // Declarar cola
    const queue = 'notifications.queue';
    await rabbitChannel.assertQueue(queue, { durable: true });
    
    // Binding
    await rabbitChannel.bindQueue(queue, 'notifications.events', 'alert.*');
    
    console.log('✅ RabbitMQ connected (notifications service)');
    
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
    
  } catch (error) {
    console.error('❌ RabbitMQ connection error:', error.message);
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
    
    // Obtener usuario
    const user = await mongoDb.collection('users').findOne({ _id: userId });
    if (!user || !user.email) {
      console.warn('User not found or no email:', userId);
      return;
    }
    
    // Enviar email según tipo
    let emailSubject = '';
    let emailBody = '';
    
    switch (type) {
      case 'alert.milestone':
        emailSubject = `NBA Alert: ${data.playerName} reached ${data.milestone}`;
        emailBody = `Your favorite player ${data.playerName} just reached ${data.milestone} points!`;
        break;
      case 'alert.game':
        emailSubject = `Upcoming Game: ${data.teamName}`;
        emailBody = `Your favorite team ${data.teamName} is playing ${data.opponent} on ${data.gameDate}`;
        break;
      default:
        emailSubject = 'NBA Analytics Hub Notification';
        emailBody = JSON.stringify(data);
    }
    
    // Enviar email (simulado si no hay configuración SMTP)
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await emailTransporter.sendMail({
        from: process.env.SMTP_USER,
        to: user.email,
        subject: emailSubject,
        text: emailBody
      });
      console.log(`Email sent to ${user.email}`);
    } else {
      console.log(`[SIMULATED] Email would be sent to ${user.email}: ${emailSubject}`);
    }
    
    // Guardar notificación en BD
    await mongoDb.collection('notifications').insertOne({
      userId,
      type,
      data,
      sentAt: new Date(),
      channel: 'email'
    });
    
  } catch (error) {
    console.error('Error processing notification:', error);
    throw error;
  }
}

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'notifications',
    mongo: mongoDb ? 'connected' : 'disconnected',
    rabbitmq: rabbitChannel ? 'connected' : 'disconnected'
  });
});

// Exportar app para tests
module.exports = app;

// Inicialización
async function start() {
  await initMongoDB();
  await initRabbitMQ();
  
  app.listen(PORT, () => {
    console.log(`🚀 Notifications service running on port ${PORT}`);
  });
}

start();

process.on('SIGTERM', async () => {
  if (rabbitConnection) await rabbitConnection.close();
  if (mongoClient) await mongoClient.close();
  process.exit(0);
});

