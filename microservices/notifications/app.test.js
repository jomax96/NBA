const request = require('supertest');

describe('Notifications Service', () => {
  let app;

  beforeEach(() => {
    // Limpiar módulo cache para reimportar
    jest.resetModules();
    jest.clearAllMocks();
    
    // Importar app
    app = require('./app');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return health check with service status', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.service).toBe('notifications');
    expect(response.body).toHaveProperty('mongo');
    expect(response.body).toHaveProperty('rabbitmq');
  });

  test('health endpoint should return correct structure', async () => {
    const response = await request(app).get('/health');
    
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('service');
    expect(response.body).toHaveProperty('mongo');
    expect(response.body).toHaveProperty('rabbitmq');
  });

  test('health endpoint should have status as healthy', async () => {
    const response = await request(app).get('/health');
    expect(response.body.status).toBe('healthy');
  });

  test('health endpoint should identify service as notifications', async () => {
    const response = await request(app).get('/health');
    expect(response.body.service).toBe('notifications');
  });

  test('health endpoint should report mongo connection status', async () => {
    const response = await request(app).get('/health');
    expect(['connected', 'disconnected']).toContain(response.body.mongo);
  });

  test('health endpoint should report rabbitmq connection status', async () => {
    const response = await request(app).get('/health');
    expect(['connected', 'disconnected']).toContain(response.body.rabbitmq);
  });
});

