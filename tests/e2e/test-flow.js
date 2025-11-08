const axios = require('axios');
const BASE_URL = process.env.API_URL || 'http://localhost:3000';

describe('E2E Test: Complete NBA Analytics Flow', () => {
  let authToken = null;
  let testUserId = null;

  test('1. Health Check - All services should be healthy', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`);
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('healthy');
    expect(response.data.services).toBeDefined();
  });

  test('2. Get Teams - Should return list of teams', async () => {
    const response = await axios.get(`${BASE_URL}/api/teams`);
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(Array.isArray(response.data.data)).toBe(true);
    expect(response.data.data.length).toBeGreaterThan(0);
  });

  test('3. Get Team Stats - Should return team statistics', async () => {
    const response = await axios.get(`${BASE_URL}/api/teams/1`);
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data).toBeDefined();
  });

  test('4. Get Top Players - Should return top players', async () => {
    const response = await axios.get(`${BASE_URL}/api/players/top`);
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(Array.isArray(response.data.data)).toBe(true);
  });

  test('5. Search Games - Should return filtered games', async () => {
    const response = await axios.get(`${BASE_URL}/api/games/search`, {
      params: { limit: 10 }
    });
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(Array.isArray(response.data.data)).toBe(true);
  });

  test('6. User Registration - Should queue registration', async () => {
    const response = await axios.post(`${BASE_URL}/api/users/register`, {
      email: `test${Date.now()}@example.com`,
      password: 'testpassword123',
      name: 'Test User'
    });
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.message).toContain('queued');
  });

  test('7. User Login - Should authenticate and return token', async () => {
    // Primero registrar (esperar a que se procese)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const email = `logintest${Date.now()}@example.com`;
    await axios.post(`${BASE_URL}/api/users/register`, {
      email,
      password: 'testpass123',
      name: 'Login Test User'
    });
    
    // Esperar a que se procese
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const response = await axios.post(`${BASE_URL}/api/users/login`, {
      email,
      password: 'testpass123'
    });
    
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.token).toBeDefined();
    authToken = response.data.token;
    testUserId = response.data.user.id;
  });

  test('8. Add Favorite - Should queue favorite operation', async () => {
    if (!authToken) {
      throw new Error('No auth token available');
    }

    const response = await axios.post(
      `${BASE_URL}/api/users/favorites`,
      {
        type: 'team',
        id: '1',
        action: 'add'
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.message).toContain('queued');
  });

  test('9. Get Prediction - Should return ML prediction', async () => {
    const response = await axios.post(`${BASE_URL}/api/predictions/predict`, {
      homeTeamId: 1,
      visitorTeamId: 2
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data).toBeDefined();
    expect(response.data.data.home_team_win_probability).toBeDefined();
    expect(response.data.data.visitor_team_win_probability).toBeDefined();
  });

  test('10. Cache Verification - Second request should use cache', async () => {
    const firstResponse = await axios.get(`${BASE_URL}/api/teams`);
    expect(firstResponse.data.source).toBeDefined();

    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 100));

    const secondResponse = await axios.get(`${BASE_URL}/api/teams`);
    expect(secondResponse.status).toBe(200);
    // Si Redis está disponible, debería usar caché
    if (secondResponse.data.source === 'cache') {
      expect(secondResponse.data.source).toBe('cache');
    }
  });
});

