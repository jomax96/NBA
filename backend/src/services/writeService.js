// backend/src/services/writeService.js
/**
 * Servicio unificado de escrituras
 * TODAS las escrituras DEBEN pasar por aquí
 * Garantiza que ninguna escritura se pierda, incluso si MongoDB está caído
 */

const { publishMessage } = require('../config/rabbitmq');
const { mongoDBCircuitBreaker } = require('../utils/circuitBreaker');
const { getMongoDB } = require('../config/database');
const logger = require('../utils/logger');

class WriteService {
    /**
     * Estrategia de escritura:
     * 1. Si MongoDB disponible: escribir directamente Y encolar (redundancia)
     * 2. Si MongoDB caído: solo encolar (procesará cuando recupere)
     */
    async executeWrite(operation) {
        const { type, userId, data } = operation;

        try {
            // Verificar si MongoDB está disponible
            const db = getMongoDB();
            const circuitState = mongoDBCircuitBreaker.getState();

            if (circuitState.state === 'CLOSED' && db) {
                // MongoDB DISPONIBLE: intentar escritura directa
                logger.info(`💾 MongoDB available - attempting direct write: ${type}`);

                try {
                    await this.performDirectWrite(type, userId, data, db);
                    logger.info(`✅ Direct write successful: ${type}`);

                    // IMPORTANTE: También encolar como respaldo
                    await this.enqueueWrite(operation);
                    logger.info(`📨 Write also enqueued as backup: ${type}`);

                    return { success: true, method: 'direct+queue' };
                } catch (directWriteError) {
                    logger.warn(`⚠️ Direct write failed, falling back to queue: ${type}`, directWriteError.message);
                    // Si falla escritura directa, el Circuit Breaker se abrirá
                    // La cola procesará cuando recupere
                }
            }

            // MongoDB NO DISPONIBLE o Circuit Breaker OPEN
            logger.warn(`⚠️ MongoDB unavailable (${circuitState.state}) - queueing write: ${type}`);
            await this.enqueueWrite(operation);

            return { success: true, method: 'queue_only' };

        } catch (error) {
            logger.error(`❌ Critical error in write operation: ${type}`, error);

            // Último intento: encolar
            try {
                await this.enqueueWrite(operation);
                return { success: true, method: 'queue_fallback' };
            } catch (queueError) {
                logger.error(`❌ CRITICAL: Failed to enqueue write: ${type}`, queueError);
                throw new Error('Write operation completely failed');
            }
        }
    }

    /**
     * Escritura directa a MongoDB
     */
    async performDirectWrite(type, userId, data, db) {
        switch (type) {
            case 'register':
                return await this.writeUserRegistration(data, db);

            case 'favorite':
                return await this.writeFavorite(userId, data, db);

            case 'alert':
                return await this.writeAlert(userId, data, db);

            case 'search_history':
                return await this.writeSearchHistory(userId, data, db);

            case 'prediction':
                return await this.writePrediction(userId, data, db);

            default:
                throw new Error(`Unknown write type: ${type}`);
        }
    }

    /**
     * Registro de usuario
     */
    async writeUserRegistration(userData, db) {
        const { email, password, name, googleId, picture, provider } = userData;

        const user = {
            email,
            name,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (password) user.password = password;
        if (googleId) {
            user.googleId = googleId;
            user.provider = provider || 'google';
            if (picture) user.picture = picture;
        }

        const result = await db.collection('users').insertOne(user);
        logger.info(`✅ User registered directly: ${email}`);
        return result;
    }

    /**
     * Favorito
     */
    async writeFavorite(userId, data, db) {
        const { favoriteType, favoriteId, action } = data;

        if (action === 'add') {
            const result = await db.collection('favorites').updateOne(
                {
                    userId: userId,
                    type: favoriteType,
                    itemId: favoriteId
                },
                {
                    $set: {
                        userId: userId,
                        type: favoriteType,
                        itemId: favoriteId,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
            logger.info(`✅ Favorite added: ${favoriteType}:${favoriteId} for user ${userId}`);
            return result;
        } else if (action === 'remove') {
            const result = await db.collection('favorites').deleteOne({
                userId: userId,
                type: favoriteType,
                itemId: favoriteId
            });
            logger.info(`✅ Favorite removed: ${favoriteType}:${favoriteId} for user ${userId}`);
            return result;
        }
    }

    /**
     * Alerta
     */
    async writeAlert(userId, data, db) {
        const { type, targetId, condition, value } = data;

        const result = await db.collection('alerts').insertOne({
            userId,
            type,
            targetId,
            condition,
            value,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        logger.info(`✅ Alert created for user ${userId}`);
        return result;
    }

    /**
     * Historial de búsqueda
     */
    async writeSearchHistory(userId, data, db) {
        const result = await db.collection('search_history').insertOne({
            userId,
            ...data,
            timestamp: new Date()
        });

        logger.info(`✅ Search history saved for user ${userId}`);
        return result;
    }

    /**
     * Predicción
     */
    async writePrediction(userId, data, db) {
        const result = await db.collection('predictions').insertOne({
            userId,
            ...data,
            timestamp: new Date()
        });

        logger.info(`✅ Prediction saved for user ${userId}`);
        return result;
    }

    /**
     * Encolar escritura en RabbitMQ
     */
    async enqueueWrite(operation) {
        const message = {
            type: operation.type,
            userId: operation.userId,
            data: operation.data,
            timestamp: new Date().toISOString(),
            nodeId: process.env.NODE_ID || 'unknown'
        };

        await publishMessage('user.operations', message);
        logger.info(`📨 Write enqueued: ${operation.type}`);
    }

    /**
     * Registro de usuario (método público)
     */
    async registerUser(userData) {
        return this.executeWrite({
            type: 'register',
            userId: null,
            data: userData
        });
    }

    /**
     * Favorito (método público)
     */
    async manageFavorite(userId, favoriteType, favoriteId, action) {
        return this.executeWrite({
            type: 'favorite',
            userId,
            data: { favoriteType, favoriteId, action }
        });
    }

    /**
     * Alerta (método público)
     */
    async createAlert(userId, alertData) {
        return this.executeWrite({
            type: 'alert',
            userId,
            data: alertData
        });
    }

    /**
     * Historial de búsqueda (método público)
     */
    async saveSearchHistory(userId, searchData) {
        return this.executeWrite({
            type: 'search_history',
            userId,
            data: searchData
        });
    }

    /**
     * Predicción (método público)
     */
    async savePrediction(userId, predictionData) {
        return this.executeWrite({
            type: 'prediction',
            userId,
            data: predictionData
        });
    }
}

// Instancia singleton
const writeService = new WriteService();

module.exports = writeService;