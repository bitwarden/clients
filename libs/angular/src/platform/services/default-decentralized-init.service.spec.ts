import { Type } from "@angular/core";

import { Initializable } from "../abstractions/decentralized-init.service";

import { DefaultDecentralizedInitService } from "./default-decentralized-init.service";

// Test service implementations
class TestService implements Initializable {
  dependencies: Type<Initializable>[] = [];
  initCalled = false;

  init(): Promise<void> | void {
    this.initCalled = true;
  }
}

function createTrackingService(name: string, executionOrder: string[]) {
  return class extends TestService {
    async init(): Promise<void> {
      executionOrder.push(name);
      await super.init();
    }
  };
}

describe("DefaultDecentralizedInitService", () => {
  let executionOrder: string[];

  beforeEach(() => {
    executionOrder = [];
  });

  describe("init", () => {
    describe("given no registered services", () => {
      it("completes without error when called", async () => {
        // Arrange
        const sut = new DefaultDecentralizedInitService([]);

        // Act & Assert
        await expect(sut.init()).resolves.not.toThrow();
      });
    });

    describe("given services with no dependencies", () => {
      it("initializes a single service when called", async () => {
        // Arrange
        const service = new TestService();
        const sut = new DefaultDecentralizedInitService([service]);

        // Act
        await sut.init();

        // Assert
        expect(service.initCalled).toBe(true);
      });

      it("initializes all services when called with multiple independent services", async () => {
        // Arrange
        const service1 = new TestService();
        const service2 = new TestService();
        const service3 = new TestService();
        const sut = new DefaultDecentralizedInitService([service1, service2, service3]);

        // Act
        await sut.init();

        // Assert
        expect(service1.initCalled).toBe(true);
        expect(service2.initCalled).toBe(true);
        expect(service3.initCalled).toBe(true);
      });
    });

    describe("given services with dependencies", () => {
      it("initializes services in dependency order when called", async () => {
        // Arrange
        const ServiceA = createTrackingService("A", executionOrder);
        const ServiceB = createTrackingService("B", executionOrder);

        const serviceA = new ServiceA();
        const serviceB = new ServiceB();
        serviceB.dependencies = [ServiceA];

        const sut = new DefaultDecentralizedInitService([serviceB, serviceA]);

        // Act
        await sut.init();

        // Assert
        expect(executionOrder).toEqual(["A", "B"]);
        expect(serviceA.initCalled).toBe(true);
        expect(serviceB.initCalled).toBe(true);
      });

      it("handles complex dependency graphs when called", async () => {
        // Arrange
        const ServiceA = createTrackingService("A", executionOrder);
        const ServiceB = createTrackingService("B", executionOrder);
        const ServiceC = createTrackingService("C", executionOrder);
        const ServiceD = createTrackingService("D", executionOrder);

        const serviceA = new ServiceA();
        const serviceB = new ServiceB();
        const serviceC = new ServiceC();
        const serviceD = new ServiceD();

        serviceC.dependencies = [ServiceA, ServiceB];
        serviceD.dependencies = [ServiceC];

        const sut = new DefaultDecentralizedInitService([serviceD, serviceB, serviceC, serviceA]);

        // Act
        await sut.init();

        // Assert
        const aIndex = executionOrder.indexOf("A");
        const bIndex = executionOrder.indexOf("B");
        const cIndex = executionOrder.indexOf("C");
        const dIndex = executionOrder.indexOf("D");

        expect(aIndex).toBeLessThan(cIndex);
        expect(bIndex).toBeLessThan(cIndex);
        expect(cIndex).toBeLessThan(dIndex);
      });

      it("handles diamond dependency pattern when called", async () => {
        // Arrange - Diamond pattern: A -> B,C -> D
        const ServiceA = createTrackingService("A", executionOrder);
        const ServiceB = createTrackingService("B", executionOrder);
        const ServiceC = createTrackingService("C", executionOrder);
        const ServiceD = createTrackingService("D", executionOrder);

        const serviceA = new ServiceA();
        const serviceB = new ServiceB();
        const serviceC = new ServiceC();
        const serviceD = new ServiceD();

        serviceB.dependencies = [ServiceA];
        serviceC.dependencies = [ServiceA];
        serviceD.dependencies = [ServiceB, ServiceC];

        const sut = new DefaultDecentralizedInitService([serviceD, serviceC, serviceB, serviceA]);

        // Act
        await sut.init();

        // Assert
        expect(executionOrder[0]).toBe("A");
        const bIndex = executionOrder.indexOf("B");
        const cIndex = executionOrder.indexOf("C");
        const dIndex = executionOrder.indexOf("D");

        expect(bIndex).toBeGreaterThan(0);
        expect(cIndex).toBeGreaterThan(0);
        expect(dIndex).toBe(3);
      });

      it("initializes each service exactly once when called", async () => {
        // Arrange
        let initCount = 0;
        class CountingService extends TestService {
          async init(): Promise<void> {
            initCount++;
            await super.init();
          }
        }

        const service = new CountingService();
        const sut = new DefaultDecentralizedInitService([service]);

        // Act
        await sut.init();

        // Assert
        expect(initCount).toBe(1);
      });
    });

    describe("given services with circular dependencies", () => {
      it("throws an error when called with two-service circular dependency", async () => {
        // Arrange
        class ServiceA extends TestService {}
        class ServiceB extends TestService {}

        const serviceA = new ServiceA();
        const serviceB = new ServiceB();

        serviceA.dependencies = [ServiceB as Type<Initializable>];
        serviceB.dependencies = [ServiceA as Type<Initializable>];

        const sut = new DefaultDecentralizedInitService([serviceA, serviceB]);

        // Act & Assert
        await expect(sut.init()).rejects.toThrow(/Circular dependency detected/);
      });

      it("throws an error when called with three-service circular dependency", async () => {
        // Arrange
        class ServiceA extends TestService {}
        class ServiceB extends TestService {}
        class ServiceC extends TestService {}

        const serviceA = new ServiceA();
        const serviceB = new ServiceB();
        const serviceC = new ServiceC();

        serviceA.dependencies = [ServiceB as Type<Initializable>];
        serviceB.dependencies = [ServiceC as Type<Initializable>];
        serviceC.dependencies = [ServiceA as Type<Initializable>];

        const sut = new DefaultDecentralizedInitService([serviceA, serviceB, serviceC]);

        // Act & Assert
        await expect(sut.init()).rejects.toThrow(/Circular dependency detected/);
      });
    });

    describe("given services with missing dependencies", () => {
      it("throws an error when called", async () => {
        // Arrange
        class ServiceA extends TestService {}
        class ServiceB extends TestService {
          dependencies = [ServiceA];
        }

        const serviceB = new ServiceB();
        const sut = new DefaultDecentralizedInitService([serviceB]);

        // Act & Assert
        await expect(sut.init()).rejects.toThrow(/not registered in INIT_SERVICES/);
      });

      it("includes dependency name and registration instructions in error when called", async () => {
        // Arrange
        class MyDependency extends TestService {}
        class MyService extends TestService {
          dependencies = [MyDependency];
        }

        const myService = new MyService();
        const sut = new DefaultDecentralizedInitService([myService]);

        // Act & Assert
        await expect(sut.init()).rejects.toThrow("MyService depends on MyDependency");
        await expect(sut.init()).rejects.toThrow("useExisting: MyDependency");
      });
    });

    describe("given a service that throws during init", () => {
      it("propagates the error when called", async () => {
        // Arrange
        class FailingService extends TestService {
          async init(): Promise<void> {
            throw new Error("Init failed!");
          }
        }

        const service = new FailingService();
        const sut = new DefaultDecentralizedInitService([service]);

        // Act & Assert
        await expect(sut.init()).rejects.toThrow(/Failed to initialize FailingService/);
        await expect(sut.init()).rejects.toThrow(/Init failed!/);
      });
    });

    describe("given services with synchronous init methods", () => {
      it("initializes the service when called", async () => {
        // Arrange
        class SyncService extends TestService {
          init(): void {
            executionOrder.push("sync");
            this.initCalled = true;
          }
        }

        const service = new SyncService();
        const sut = new DefaultDecentralizedInitService([service]);

        // Act
        await sut.init();

        // Assert
        expect(service.initCalled).toBe(true);
        expect(executionOrder).toEqual(["sync"]);
      });

      it("respects dependency order when called with mixed sync and async services", async () => {
        // Arrange
        class SyncService extends TestService {
          init(): void {
            executionOrder.push("sync");
            this.initCalled = true;
          }
        }

        class AsyncService extends TestService {
          dependencies = [SyncService];

          async init(): Promise<void> {
            executionOrder.push("async");
            await super.init();
          }
        }

        const syncService = new SyncService();
        const asyncService = new AsyncService();
        const sut = new DefaultDecentralizedInitService([asyncService, syncService]);

        // Act
        await sut.init();

        // Assert
        expect(executionOrder).toEqual(["sync", "async"]);
      });
    });
  });
});
