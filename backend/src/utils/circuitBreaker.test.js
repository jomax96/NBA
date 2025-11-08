const { CircuitBreaker } = require('./circuitBreaker');

describe('CircuitBreaker', () => {
  let circuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeout: 30000,
      resetTimeout: 1000 // 1 segundo para tests
    });
  });

  test('should start in CLOSED state', () => {
    expect(circuitBreaker.state).toBe('CLOSED');
    expect(circuitBreaker.failureCount).toBe(0);
  });

  test('should execute function successfully', async () => {
    const fn = async () => 'success';
    const result = await circuitBreaker.execute(fn);
    expect(result).toBe('success');
    expect(circuitBreaker.state).toBe('CLOSED');
  });

  test('should increment failure count on error', async () => {
    const fn = async () => {
      throw new Error('Test error');
    };

    try {
      await circuitBreaker.execute(fn);
    } catch (error) {
      expect(error.message).toBe('Test error');
    }

    expect(circuitBreaker.failureCount).toBe(1);
    expect(circuitBreaker.state).toBe('CLOSED');
  });

  test('should open circuit after threshold failures', async () => {
    const fn = async () => {
      throw new Error('Test error');
    };

    // Simular 3 fallos
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn);
      } catch (error) {
        // Expected
      }
    }

    expect(circuitBreaker.state).toBe('OPEN');
    expect(circuitBreaker.failureCount).toBe(3);
  });

  test('should use fallback when circuit is open', async () => {
    const fn = async () => {
      throw new Error('Test error');
    };
    const fallback = async () => 'fallback result';

    // Abrir circuito
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn);
      } catch (error) {
        // Expected
      }
    }

    // Ejecutar con fallback
    const result = await circuitBreaker.execute(fn, fallback);
    expect(result).toBe('fallback result');
  });

  test('should reset failure count on success', async () => {
    const fn = async () => {
      throw new Error('Test error');
    };

    // Simular 2 fallos
    for (let i = 0; i < 2; i++) {
      try {
        await circuitBreaker.execute(fn);
      } catch (error) {
        // Expected
      }
    }

    expect(circuitBreaker.failureCount).toBe(2);

    // Ejecutar éxito
    const successFn = async () => 'success';
    await circuitBreaker.execute(successFn);

    expect(circuitBreaker.failureCount).toBe(0);
    expect(circuitBreaker.state).toBe('CLOSED');
  });
});

