const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');

let mysqlPool = null;
let mongoClient = null;
let mongoDb = null;

/**
 * Inicializa conexión a MySQL
 */
async function initMySQL() {
  try {
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: process.env.MYSQL_PORT,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    // Test connection
    const connection = await mysqlPool.getConnection();
    await connection.ping();
    connection.release();

    console.log('✅ MySQL connected successfully');
    return mysqlPool;
  } catch (error) {
    console.error('❌ MySQL connection error:', error.message);
    throw error;
  }
}

/**
 * Inicializa conexión a MongoDB
 */
async function initMongoDB() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nba_users';
    mongoClient = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await mongoClient.connect();
    mongoDb = mongoClient.db('nba_users');

    console.log('✅ MongoDB connected successfully');
    return mongoDb;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
}

/**
 * Obtiene pool de MySQL
 */
function getMySQLPool() {
  return mysqlPool;
}

/**
 * Obtiene instancia de MongoDB
 */
function getMongoDB() {
  return mongoDb;
}

/**
 * Verifica salud de MySQL
 */
async function checkMySQLHealth() {
  try {
    if (!mysqlPool) return false;
    const connection = await mysqlPool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Verifica salud de MongoDB
 */
async function checkMongoDBHealth() {
  try {
    if (!mongoClient) return false;
    await mongoClient.db('admin').command({ ping: 1 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Cierra todas las conexiones
 */
async function closeConnections() {
  try {
    if (mysqlPool) {
      await mysqlPool.end();
      console.log('MySQL connection closed');
    }
    if (mongoClient) {
      await mongoClient.close();
      console.log('MongoDB connection closed');
    }
  } catch (error) {
    console.error('Error closing connections:', error);
  }
}

module.exports = {
  initMySQL,
  initMongoDB,
  getMySQLPool,
  getMongoDB,
  checkMySQLHealth,
  checkMongoDBHealth,
  closeConnections
};

