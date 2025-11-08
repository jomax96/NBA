const cacheService = require('./cacheService');

describe('CacheService', () => {
  beforeEach(async () => {
    // Mock Redis client
    const mockRedis = {
      isOpen: true,
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    };

    cacheService.redisClient = mockRedis;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return null when Redis is not available', async () => {
    cacheService.redisClient = null;
    const result = await cacheService.get('test-key');
    expect(result).toBeNull();
  });

  test('should get value from cache', async () => {
    const mockValue = JSON.stringify({ data: 'test' });
    cacheService.redisClient.get.mockResolvedValue(mockValue);

    const result = await cacheService.get('test-key');
    expect(result).toEqual({ data: 'test' });
    expect(cacheService.redisClient.get).toHaveBeenCalledWith('test-key');
  });

  test('should return null on cache miss', async () => {
    cacheService.redisClient.get.mockResolvedValue(null);
    const result = await cacheService.get('test-key');
    expect(result).toBeNull();
  });

  test('should set value in cache', async () => {
    cacheService.redisClient.setEx.mockResolvedValue('OK');
    const value = { data: 'test' };

    const result = await cacheService.set('test-key', value, 300);
    expect(result).toBe(true);
    expect(cacheService.redisClient.setEx).toHaveBeenCalledWith(
      'test-key',
      300,
      JSON.stringify(value)
    );
  });

  test('should delete key from cache', async () => {
    cacheService.redisClient.del.mockResolvedValue(1);
    const result = await cacheService.delete('test-key');
    expect(result).toBe(true);
    expect(cacheService.redisClient.del).toHaveBeenCalledWith('test-key');
  });

  test('should delete pattern from cache', async () => {
    cacheService.redisClient.keys.mockResolvedValue(['key1', 'key2']);
    cacheService.redisClient.del.mockResolvedValue(2);

    const result = await cacheService.deletePattern('test:*');
    expect(result).toBe(true);
    expect(cacheService.redisClient.keys).toHaveBeenCalledWith('test:*');
    expect(cacheService.redisClient.del).toHaveBeenCalledWith(['key1', 'key2']);
  });
});

