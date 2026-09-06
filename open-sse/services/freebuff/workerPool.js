import { FreebuffPtyWorker } from "./ptyWorker.js";

export class FreebuffWorkerPool {
  constructor() {
    /** @type {Map<string, FreebuffPtyWorker>} */
    this.workers = new Map();
  }

  /**
   * Get an existing worker or instantiate a new one for this connectionId.
   */
  getOrCreateWorker(connectionId, log = console) {
    if (!connectionId) {
      throw new Error("Freebuff connectionId is required for worker allocation");
    }

    let worker = this.workers.get(connectionId);
    if (!worker || worker.isDead) {
      worker = new FreebuffPtyWorker({ connectionId, log });
      this.workers.set(connectionId, worker);
    }
    return worker;
  }

  /**
   * Dispatches a request to the worker for the given connectionId.
   * Guarantees that only ONE active request runs per Freebuff account at a time.
   * If the worker is busy, the request is queued.
   */
  async dispatch({ connectionId, model, prompt, stream = false, onChunk = null, signal = null, log = console }) {
    const worker = this.getOrCreateWorker(connectionId, log);

    // If worker is busy, enqueue the execution
    if (worker.busy) {
      log?.info?.("FREEBUFF_POOL", `Account ${connectionId} is busy. Queueing request (queue length: ${worker.queue.length + 1})`);
      return new Promise((resolve, reject) => {
        worker.queue.push({
          execute: async () => {
            worker.busy = true;
            try {
              const res = await worker.executeTurn({ prompt, model, stream, onChunk, signal });
              resolve(res);
            } catch (err) {
              reject(err);
            } finally {
              worker.busy = false;
            }
          },
          reject,
        });
      });
    }

    // Worker is not busy, mark busy immediately and execute
    worker.busy = true;
    try {
      const result = await worker.executeTurn({ prompt, model, stream, onChunk, signal });
      return result;
    } finally {
      worker.busy = false;
      // Process next in queue if any
      this.processQueue(worker);
    }
  }

  async processQueue(worker) {
    if (!worker || worker.busy || worker.queue.length === 0) return;
    const nextTask = worker.queue.shift();
    if (!nextTask) return;

    try {
      await nextTask.execute();
    } catch {
      /* handled inside task */
    } finally {
      this.processQueue(worker);
    }
  }

  restartWorker(connectionId) {
    const worker = this.workers.get(connectionId);
    if (worker) {
      worker.stop();
      this.workers.delete(connectionId);
    }
    return this.getOrCreateWorker(connectionId);
  }

  stopWorker(connectionId) {
    const worker = this.workers.get(connectionId);
    if (worker) {
      worker.stop();
      this.workers.delete(connectionId);
    }
  }

  getWorkerStatus(connectionId) {
    const worker = this.workers.get(connectionId);
    if (!worker) return { status: "stopped", busy: false, queueLength: 0 };
    return {
      status: worker.isDead ? "dead" : worker.busy ? "busy" : "ready",
      busy: worker.busy,
      currentModel: worker.currentModel,
      queueLength: worker.queue.length,
      startedAt: worker.startedAt,
      lastActivityAt: worker.lastActivityAt,
    };
  }
}

export const freebuffWorkerPool = new FreebuffWorkerPool();
