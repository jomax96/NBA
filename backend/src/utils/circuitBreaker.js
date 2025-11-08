/**
 * Circuit Breaker Pattern
 * Detecta fallos de BD y redirige automáticamente a caché/cola
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 3;
    this.timeout = options.timeout || parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 30000;
    this.resetTimeout = options.resetTimeout || parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT) || 30000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.nextAttempt = Date.now();
    this.lastFailureTime = null;
  }

  /**
   * Ejecuta función con protección de Circuit Breaker
   */
  async execute(fn, fallbackFn = null) {
    if (this.state === 'OPEN') {
      // Circuito abierto, verificar si debemos intentar half-open
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        console.log('Circuit Breaker: Attempting half-open state');
      } else {
        // Todavía en timeout, usar fallback
        if (fallbackFn) {
          return await fallbackFn();
        }
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallbackFn) {
        return await fallbackFn();
      }
      throw error;
    }
  }

  /**
   * Maneja éxito
   */
  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log('Circuit Breaker: Closed after successful half-open attempt');
    }
  }

  /**
   * Maneja fallo
   */
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.log(`Circuit Breaker: OPENED after ${this.failureCount} failures. Next attempt in ${this.resetTimeout}ms`);
    }
  }

  /**
   * Obtiene estado actual
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.nextAttempt,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * Resetea manualmente
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.nextAttempt = Date.now();
    this.lastFailureTime = null;
    console.log('Circuit Breaker: Manually reset to CLOSED');
  }
}

// Instancia global del Circuit Breaker para MongoDB (SPOF intencional)
const mongoDBCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  timeout: 30000,
  resetTimeout: 30000
});

// Circuit Breaker para MySQL (Read-Only, menos crítico)
const mysqlCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  timeout: 30000,
  resetTimeout: 30000
});

module.exports = {
  CircuitBreaker,
  mongoDBCircuitBreaker,
  mysqlCircuitBreaker
};

