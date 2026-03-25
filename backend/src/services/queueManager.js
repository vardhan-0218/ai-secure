/**
 * AI Request Queue Manager
 * ========================
 * Provides an in-memory priority queue to limit parallel AI calls,
 * handle retries automatically, and enforce backpressure for the streaming pipeline.
 */

const { EventEmitter } = require('events');
const logger = require('../utils/logger');

class QueueManager extends EventEmitter {
  constructor(concurrency = 3, maxQueueSize = 100) {
    super();
    this.concurrency = concurrency;
    this.maxQueueSize = maxQueueSize;
    this.queue = [];
    this.activeCount = 0;
    this.metrics = {
      processed: 0,
      failed: 0,
      retried: 0
    };
  }

  /**
   * Enqueue an async task.
   * @param {Function} taskFn - The async function to execute.
   * @param {Object} options - { priority: number, retries: number }
   * @returns {Promise} Resolves/rejects with the task's result.
   */
  enqueue(taskFn, options = {}) {
    const priority = options.priority || 0;
    const maxRetries = options.retries ?? 1;

    if (this.queue.length >= this.maxQueueSize) {
      return Promise.reject(new Error(`QueueManager: max queue size (${this.maxQueueSize}) reached. Backpressure active.`));
    }

    return new Promise((resolve, reject) => {
      const item = { taskFn, resolve, reject, priority, maxRetries, currentAttempt: 0 };
      
      // Insert by priority (higher = processed sooner)
      const index = this.queue.findIndex(qItem => qItem.priority < priority);
      if (index === -1) {
        this.queue.push(item);
      } else {
        this.queue.splice(index, 0, item);
      }

      this._emitStats();
      this._processNext();
    });
  }

  async _processNext() {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    this.activeCount++;
    this._emitStats();

    try {
      item.currentAttempt++;
      const result = await item.taskFn();
      this.metrics.processed++;
      item.resolve(result);
    } catch (err) {
      if (item.currentAttempt <= item.maxRetries) {
        logger.warn(`QueueManager: task failed (attempt ${item.currentAttempt}). Retrying... Error: ${err.message}`);
        this.metrics.retried++;
        // Re-enqueue at high priority so it executes quickly
        this.queue.unshift(item);
      } else {
        logger.error(`QueueManager: task permanently failed after ${item.currentAttempt} attempts. Error: ${err.message}`);
        this.metrics.failed++;
        item.reject(err);
      }
    } finally {
      this.activeCount--;
      this._emitStats();
      this._processNext(); // Kick off next
    }
  }

  _emitStats() {
    this.emit('stats', {
      active: this.activeCount,
      queued: this.queue.length,
      processed: this.metrics.processed,
      failed: this.metrics.failed,
      retried: this.metrics.retried,
      backpressure: this.queue.length > (this.maxQueueSize * 0.8) // Signal UI if queue > 80%
    });
  }

  clear() {
    for (const item of this.queue) {
      item.reject(new Error("Queue cleared"));
    }
    this.queue = [];
    this._emitStats();
  }
}

// Global default queue for AI streams
const aiStreamQueue = new QueueManager(3, 200);

module.exports = {
  QueueManager,
  aiStreamQueue
};
