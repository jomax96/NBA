const queueService = require('./queueService');
const { publishMessage } = require('../config/rabbitmq');

jest.mock('../config/rabbitmq');

describe('QueueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should enqueue user registration', async () => {
    publishMessage.mockResolvedValue(true);
    const userData = {
      email: 'test@example.com',
      password: 'hashedpassword',
      name: 'Test User'
    };

    const result = await queueService.enqueueUserRegistration(userData);
    expect(result).toBe(true);
    expect(publishMessage).toHaveBeenCalledWith(
      'user.operations',
      expect.objectContaining({
        type: 'register',
        data: userData
      })
    );
  });

  test('should enqueue favorite operation', async () => {
    publishMessage.mockResolvedValue(true);
    const result = await queueService.enqueueFavorite('user123', 'team', 'team456', 'add');

    expect(result).toBe(true);
    expect(publishMessage).toHaveBeenCalledWith(
      'user.operations',
      expect.objectContaining({
        type: 'favorite',
        userId: 'user123',
        data: {
          favoriteType: 'team',
          favoriteId: 'team456',
          action: 'add'
        }
      })
    );
  });

  test('should enqueue alert', async () => {
    publishMessage.mockResolvedValue(true);
    const alertData = {
      type: 'milestone',
      message: 'Player reached 30 points'
    };

    const result = await queueService.enqueueAlert('user123', alertData);
    expect(result).toBe(true);
    expect(publishMessage).toHaveBeenCalledWith(
      'user.operations',
      expect.objectContaining({
        type: 'alert',
        userId: 'user123',
        data: alertData
      })
    );
  });

  test('should enqueue search history', async () => {
    publishMessage.mockResolvedValue(true);
    const searchData = {
      query: 'Lakers',
      filters: { team: 'LAL' }
    };

    const result = await queueService.enqueueSearchHistory('user123', searchData);
    expect(result).toBe(true);
    expect(publishMessage).toHaveBeenCalledWith(
      'user.operations',
      expect.objectContaining({
        type: 'search_history',
        userId: 'user123',
        data: searchData
      })
    );
  });

  test('should enqueue prediction request', async () => {
    publishMessage.mockResolvedValue(true);
    const predictionData = {
      homeTeamId: 'team1',
      visitorTeamId: 'team2'
    };

    const result = await queueService.enqueuePredictionRequest('user123', predictionData);
    expect(result).toBe(true);
    expect(publishMessage).toHaveBeenCalledWith(
      'user.operations',
      expect.objectContaining({
        type: 'prediction',
        userId: 'user123',
        data: predictionData
      })
    );
  });
});

