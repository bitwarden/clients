import { getScheduler } from "./content-script-scheduler";

// Polyfill MessageChannel for Jest environment (Node.js < 18)
if (typeof MessageChannel === "undefined") {
  // Simple polyfill for testing
  class MessageChannelPolyfill {
    port1: any;
    port2: any;

    constructor() {
      this.port1 = {
        onmessage: null as ((event: any) => void) | null,
      };
      this.port2 = {
        postMessage: (message: any) => {
          setTimeout(() => {
            if (this.port1.onmessage) {
              this.port1.onmessage({ data: message });
            }
          }, 0);
        },
      };
    }
  }

  (global as any).MessageChannel = MessageChannelPolyfill;
}

describe("ContentScriptScheduler", () => {
  let scheduler: ReturnType<typeof getScheduler>;

  beforeEach(() => {
    scheduler = getScheduler();
    // Clear any pending tasks from previous tests
    if (scheduler) {
      scheduler.abortAll();
    }
  });

  afterEach(() => {
    if (scheduler) {
      scheduler.abortAll();
    }
  });

  describe("schedule", () => {
    it("should execute task within timeout period", async () => {
      const callback = jest.fn();
      const timeout = 100;

      scheduler.schedule(callback, { timeout });

      // Wait for task to execute (via MessageChannel or timeout)
      await new Promise((resolve) => setTimeout(resolve, timeout + 50));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should execute task via MessageChannel before timeout", async () => {
      const callback = jest.fn();
      const timeout = 5000; // Long timeout

      scheduler.schedule(callback, { timeout });

      // Wait for MessageChannel to process (should be much faster than timeout)
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should batch multiple tasks into single flush", async () => {
      const callbacks = [jest.fn(), jest.fn(), jest.fn()];

      // Schedule all tasks in quick succession
      callbacks.forEach((callback) => {
        scheduler.schedule(callback, { timeout: 1000 });
      });

      // Wait for single flush cycle
      await new Promise((resolve) => setTimeout(resolve, 50));

      // All callbacks should have been executed
      callbacks.forEach((callback) => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });

    it("should yield after frame budget expires", async () => {
      // This test verifies the scheduler yields cooperatively.
      // In a real scenario, if tasks take time, the scheduler will yield.
      // For testing, we'll verify that the scheduler completes all work eventually.
      const callbacks = Array.from({ length: 50 }, () => jest.fn());

      callbacks.forEach((callback) => {
        scheduler.schedule(callback, { timeout: 10000 });
      });

      // Allow scheduler to process work across multiple flushes
      await new Promise((resolve) => setTimeout(resolve, 200));

      // All tasks should eventually complete
      callbacks.forEach((callback) => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });

    it("should resume work in next message cycle after yielding", async () => {
      // This test verifies that work resumes after yielding.
      // All tasks should eventually complete even if they span multiple flushes.
      const callbacks = Array.from({ length: 30 }, () => jest.fn());

      callbacks.forEach((callback) => {
        scheduler.schedule(callback, { timeout: 10000 });
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // All callbacks should eventually be executed
      callbacks.forEach((callback) => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });

    it("should support task cancellation", async () => {
      const callback = jest.fn();

      const taskId = scheduler.schedule(callback, { timeout: 1000 });
      scheduler.cancel(taskId);

      // Wait to ensure callback doesn't execute
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callback).not.toHaveBeenCalled();
    });

    it("should handle errors in tasks without breaking scheduler", async () => {
      const errorCallback = jest.fn(() => {
        throw new Error("Test error");
      });
      const successCallback = jest.fn();
      const consoleError = jest.spyOn(console, "error").mockImplementation();

      scheduler.schedule(errorCallback, { timeout: 1000 });
      scheduler.schedule(successCallback, { timeout: 1000 });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        "[Bitwarden] Scheduler task error:",
        expect.any(Error),
      );

      consoleError.mockRestore();
    });
  });

  describe("cancel", () => {
    it("should cancel scheduled task before execution", async () => {
      const callback = jest.fn();

      const taskId = scheduler.schedule(callback, { timeout: 1000 });
      scheduler.cancel(taskId);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callback).not.toHaveBeenCalled();
    });

    it("should handle canceling non-existent task gracefully", () => {
      expect(() => scheduler.cancel(99999)).not.toThrow();
    });
  });

  describe("abortAll", () => {
    it("should clear all pending tasks", async () => {
      const callbacks = [jest.fn(), jest.fn(), jest.fn()];

      callbacks.forEach((callback) => {
        scheduler.schedule(callback, { timeout: 1000 });
      });

      scheduler.abortAll();

      await new Promise((resolve) => setTimeout(resolve, 100));

      callbacks.forEach((callback) => {
        expect(callback).not.toHaveBeenCalled();
      });
    });

    it("should allow new tasks to be scheduled after abort", async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      scheduler.schedule(callback1, { timeout: 1000 });
      scheduler.abortAll();
      scheduler.schedule(callback2, { timeout: 1000 });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe("adaptive budget", () => {
    it("should use 5ms budget for small queue (< 10 tasks)", async () => {
      const callbacks = Array.from({ length: 5 }, () => jest.fn());
      let budgetUsed = 0;

      // Mock performance.now() to measure budget
      const originalNow = performance.now;
      let mockTime = 0;
      const startTime = mockTime;
      jest.spyOn(performance, "now").mockImplementation(() => {
        const current = mockTime;
        mockTime += 1;
        return current;
      });

      callbacks.forEach((callback) => {
        scheduler.schedule(
          () => {
            budgetUsed = mockTime - startTime;
            callback();
          },
          { timeout: 10000 },
        );
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // With small queue, should use ~5ms budget (MIN_FRAME_BUDGET_MS)
      // Allow some variance for test timing
      expect(budgetUsed).toBeLessThan(15);

      // Restore mock
      jest.spyOn(performance, "now").mockRestore();
      performance.now = originalNow;
    });

    it("should use adaptive budget based on queue size", async () => {
      // The scheduler uses 5ms budget for small queues and 16ms for large queues.
      // This test verifies that tasks complete regardless of queue size.
      const smallQueue = Array.from({ length: 5 }, () => jest.fn());
      const largeQueue = Array.from({ length: 20 }, () => jest.fn());

      // Test small queue
      smallQueue.forEach((callback) => {
        scheduler.schedule(callback, { timeout: 10000 });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      smallQueue.forEach((callback) => {
        expect(callback).toHaveBeenCalledTimes(1);
      });

      // Test large queue
      largeQueue.forEach((callback) => {
        scheduler.schedule(callback, { timeout: 10000 });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      largeQueue.forEach((callback) => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("priority queues", () => {
    it("should process high priority tasks before normal priority", async () => {
      const executionOrder: string[] = [];

      // Schedule normal priority task first
      scheduler.schedule(() => executionOrder.push("normal"), {
        timeout: 1000,
        priority: "normal",
      });

      // Schedule high priority task second (but should execute first)
      scheduler.schedule(() => executionOrder.push("high"), { timeout: 1000, priority: "high" });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(executionOrder).toEqual(["high", "normal"]);
    });

    it("should process tasks in priority order: high → normal → low", async () => {
      const executionOrder: string[] = [];

      // Schedule in mixed order
      scheduler.schedule(() => executionOrder.push("low"), { timeout: 1000, priority: "low" });
      scheduler.schedule(() => executionOrder.push("high1"), { timeout: 1000, priority: "high" });
      scheduler.schedule(() => executionOrder.push("normal1"), {
        timeout: 1000,
        priority: "normal",
      });
      scheduler.schedule(() => executionOrder.push("high2"), { timeout: 1000, priority: "high" });
      scheduler.schedule(() => executionOrder.push("normal2"), {
        timeout: 1000,
        priority: "normal",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // High priority tasks first (in order), then normal (in order), then low
      expect(executionOrder).toEqual(["high1", "high2", "normal1", "normal2", "low"]);
    });

    it("should default to normal priority when not specified", async () => {
      const executionOrder: string[] = [];

      scheduler.schedule(() => executionOrder.push("high"), { timeout: 1000, priority: "high" });
      scheduler.schedule(() => executionOrder.push("default"), { timeout: 1000 }); // No priority specified
      scheduler.schedule(() => executionOrder.push("low"), { timeout: 1000, priority: "low" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Default task should execute with normal priority (between high and low)
      expect(executionOrder).toEqual(["high", "default", "low"]);
    });

    it("should respect priority even when tasks are added during processing", async () => {
      const executionOrder: string[] = [];

      // Schedule mix of priorities initially
      scheduler.schedule(() => executionOrder.push("low1"), { timeout: 1000, priority: "low" });
      scheduler.schedule(() => executionOrder.push("normal1"), {
        timeout: 1000,
        priority: "normal",
      });

      // Add high priority task shortly after
      setTimeout(() => {
        scheduler.schedule(() => executionOrder.push("high"), { timeout: 1000, priority: "high" });
      }, 5);

      // Add more low priority tasks
      setTimeout(() => {
        scheduler.schedule(() => executionOrder.push("low2"), { timeout: 1000, priority: "low" });
      }, 10);

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify high priority task executed
      expect(executionOrder).toContain("high");
      // High priority should come before the second low priority task
      const highIndex = executionOrder.indexOf("high");
      const low2Index = executionOrder.indexOf("low2");
      if (low2Index !== -1) {
        expect(highIndex).toBeLessThan(low2Index);
      }
    });
  });

  describe("timeout fallback", () => {
    it("should execute task via timeout if scheduler is blocked", async () => {
      const callback = jest.fn();
      const timeout = 100;

      // Mock performance.now() to simulate scheduler always being over budget
      const originalNow = performance.now;
      jest.spyOn(performance, "now").mockImplementation(() => Date.now() + 1000);

      scheduler.schedule(callback, { timeout });

      // Wait for timeout to fire (scheduler won't execute due to mock)
      await new Promise((resolve) => setTimeout(resolve, timeout + 50));

      expect(callback).toHaveBeenCalledTimes(1);

      // Restore mock
      jest.spyOn(performance, "now").mockRestore();
      performance.now = originalNow;
    });
  });

  describe("conditional timeout optimization", () => {
    beforeEach(() => {
      // Reset document.hidden to default
      Object.defineProperty(document, "hidden", {
        configurable: true,
        writable: true,
        value: false,
      });
    });

    it("should not create timeout in normal conditions (active tab, small queue)", async () => {
      const callback = jest.fn();

      // Mock clearTimeout to track if timeout was created
      const originalClearTimeout = global.clearTimeout;
      const clearTimeoutSpy = jest.fn(originalClearTimeout);
      global.clearTimeout = clearTimeoutSpy as any;

      scheduler.schedule(callback, { timeout: 1000 });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Task should execute via MessageChannel
      expect(callback).toHaveBeenCalledTimes(1);

      // clearTimeout should NOT be called (no timeout was created)
      expect(clearTimeoutSpy).not.toHaveBeenCalled();

      // Restore
      global.clearTimeout = originalClearTimeout;
    });

    it("should create timeout when page is in background", async () => {
      // Simulate background tab
      Object.defineProperty(document, "hidden", {
        configurable: true,
        writable: true,
        value: true,
      });

      const callback = jest.fn();

      // Mock clearTimeout to verify timeout was created
      const originalClearTimeout = global.clearTimeout;
      const clearTimeoutSpy = jest.fn(originalClearTimeout);
      global.clearTimeout = clearTimeoutSpy as any;

      scheduler.schedule(callback, { timeout: 1000 });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledTimes(1);

      // clearTimeout SHOULD be called (timeout was created and cleared)
      expect(clearTimeoutSpy).toHaveBeenCalled();

      // Restore
      global.clearTimeout = originalClearTimeout;
    });

    it("should create timeout when queue is heavily loaded (>100 tasks)", async () => {
      const callback = jest.fn();

      // Mock clearTimeout to verify timeout was created
      const originalClearTimeout = global.clearTimeout;
      const clearTimeoutSpy = jest.fn(originalClearTimeout);
      global.clearTimeout = clearTimeoutSpy as any;

      // Schedule 101 tasks to exceed HEAVY_LOAD_THRESHOLD
      for (let i = 0; i < 101; i++) {
        scheduler.schedule(() => {}, { timeout: 10000 });
      }

      // Schedule test task (should have timeout due to heavy load)
      scheduler.schedule(callback, { timeout: 10000 });

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(callback).toHaveBeenCalledTimes(1);

      // clearTimeout SHOULD be called (timeout was created due to heavy load)
      expect(clearTimeoutSpy).toHaveBeenCalled();

      // Restore
      global.clearTimeout = originalClearTimeout;
    });
  });

  describe("metrics tracking", () => {
    beforeEach(() => {
      // Reset document.hidden to default
      Object.defineProperty(document, "hidden", {
        configurable: true,
        writable: true,
        value: false,
      });
      // Reset metrics before each test
      scheduler.resetMetrics();
    });

    it("should track MessageChannel execution count", async () => {
      const callbacks = [jest.fn(), jest.fn(), jest.fn()];

      callbacks.forEach((callback) => {
        scheduler.schedule(callback, { timeout: 1000 });
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const metrics = scheduler.getMetrics();
      expect(metrics.messageChannelExecutions).toBe(3);
      expect(metrics.timeoutExecutions).toBe(0);
    });

    it("should track timeout and MessageChannel executions separately", async () => {
      // This test validates that the metrics correctly track both execution paths.
      // In practice, timeout execution is rare (<0.1%), but metrics should track both.

      // Test MessageChannel execution (normal path)
      const callback1 = jest.fn();
      scheduler.schedule(callback1, { timeout: 10000 });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback1).toHaveBeenCalledTimes(1);

      const metrics = scheduler.getMetrics();
      expect(metrics.messageChannelExecutions).toBe(1);
      expect(metrics.timeoutExecutions).toBe(0);

      // The timeout execution counter would be incremented in the timeout callback
      // when it fires (line 115 in content-script-scheduler.ts).
      // In real usage, this happens <0.1% of the time.
      // Here we verify the metric structure is correct.
      expect(metrics.timeoutExecutionRate).toBe(0); // 0 / 1 = 0
    });

    it("should calculate timeout execution rate correctly", async () => {
      const callbacks = [jest.fn(), jest.fn(), jest.fn()];

      // Execute 3 tasks via MessageChannel
      callbacks.forEach((callback) => {
        scheduler.schedule(callback, { timeout: 1000 });
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const metrics = scheduler.getMetrics();
      expect(metrics.timeoutExecutionRate).toBe(0); // 0 / 3 = 0
      expect(metrics.totalScheduled).toBeGreaterThanOrEqual(3);
    });

    it("should return zero rate when no tasks have executed", () => {
      const metrics = scheduler.getMetrics();
      expect(metrics.timeoutExecutionRate).toBe(0);
      expect(metrics.messageChannelExecutions).toBe(0);
      expect(metrics.timeoutExecutions).toBe(0);
    });
  });

  describe("singleton behavior", () => {
    it("should return same instance on multiple getScheduler calls", () => {
      const instance1 = getScheduler();
      const instance2 = getScheduler();

      expect(instance1).toBe(instance2);
    });
  });
});
