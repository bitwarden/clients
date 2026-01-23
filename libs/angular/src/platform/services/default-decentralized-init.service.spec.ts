import { Dependency, Initializable } from "@bitwarden/common/platform/abstractions/initializable";
import { Injector } from "@bitwarden/common/platform/abstractions/injector";
import { DefaultDecentralizedInitService } from "@bitwarden/common/platform/services/default-decentralized-init.service";

// Test service implementations
class TestService implements Initializable {
  dependencies: Dependency[] = [];
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

// Helper to create a mock Injector that maps tokens to instances
function createMockInjector(tokenMap: Map<Dependency, Initializable>): Injector {
  return {
    get: <T>(token: Dependency): T => {
      const instance = tokenMap.get(token);
      if (!instance) {
        throw new Error(`No provider for ${token.name}!`);
      }
      return instance as T;
    },
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
        const mockInjector = createMockInjector(new Map());
        const sut = new DefaultDecentralizedInitService([], mockInjector);

        // Act & Assert
        await expect(sut.init()).resolves.not.toThrow();
      });
    });

    describe("given services with no dependencies", () => {
      it("initializes a single service when called", async () => {
        // Arrange
        const service = new TestService();
        const tokenMap = new Map([[TestService, service]]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService([TestService], mockInjector);

        // Act
        await sut.init();

        // Assert
        expect(service.initCalled).toBe(true);
      });

      it("initializes all services when called with multiple independent services", async () => {
        // Arrange
        class Service1 extends TestService {}
        class Service2 extends TestService {}
        class Service3 extends TestService {}

        const service1 = new Service1();
        const service2 = new Service2();
        const service3 = new Service3();

        const tokenMap = new Map([
          [Service1, service1],
          [Service2, service2],
          [Service3, service3],
        ]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService(
          [Service1, Service2, Service3],
          mockInjector,
        );

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

        const tokenMap = new Map([
          [ServiceA, serviceA],
          [ServiceB, serviceB],
        ]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService([ServiceB, ServiceA], mockInjector);

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

        const tokenMap = new Map([
          [ServiceA, serviceA],
          [ServiceB, serviceB],
          [ServiceC, serviceC],
          [ServiceD, serviceD],
        ]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService(
          [ServiceD, ServiceB, ServiceC, ServiceA],
          mockInjector,
        );

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

        const tokenMap = new Map([
          [ServiceA, serviceA],
          [ServiceB, serviceB],
          [ServiceC, serviceC],
          [ServiceD, serviceD],
        ]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService(
          [ServiceD, ServiceC, ServiceB, ServiceA],
          mockInjector,
        );

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
        const tokenMap = new Map([[CountingService, service]]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService([CountingService], mockInjector);

        // Act
        await sut.init();

        // Assert
        expect(initCount).toBe(1);
      });

      it("resolves dependencies by abstract parent class when called", async () => {
        // Arrange - Simulates Angular pattern:
        // { provide: AbstractService, useClass: ConcreteService }
        // { provide: INIT_SERVICES, useValue: AbstractService, multi: true }
        abstract class AbstractBaseService extends TestService {
          abstract someMethod(): void;
        }

        class ConcreteImplementation extends AbstractBaseService {
          someMethod(): void {
            executionOrder.push("method");
          }

          async init(): Promise<void> {
            executionOrder.push("concrete");
            await super.init();
          }
        }

        class DependentService extends TestService {
          // References the abstract class, not the concrete implementation
          dependencies = [AbstractBaseService as Dependency];

          async init(): Promise<void> {
            executionOrder.push("dependent");
            await super.init();
          }
        }

        // Register using the abstract token (what's in INIT_SERVICES)
        // Angular DI provides the concrete implementation
        const concreteService = new ConcreteImplementation();
        const dependentService = new DependentService();

        const tokenMap = new Map<Dependency, Initializable>([
          [AbstractBaseService as Dependency, concreteService], // Token points to concrete instance
          [DependentService as Dependency, dependentService],
        ]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService(
          [DependentService as Dependency, AbstractBaseService as Dependency],
          mockInjector,
        );

        // Act
        await sut.init();

        // Assert
        // Should resolve AbstractBaseService token to ConcreteImplementation instance
        expect(executionOrder).toEqual(["concrete", "dependent"]);
        expect(concreteService.initCalled).toBe(true);
        expect(dependentService.initCalled).toBe(true);
      });
    });

    describe("given services with circular dependencies", () => {
      it("throws an error when called with two-service circular dependency", async () => {
        // Arrange
        class ServiceA extends TestService {}
        class ServiceB extends TestService {}

        const serviceA = new ServiceA();
        const serviceB = new ServiceB();

        serviceA.dependencies = [ServiceB as Dependency];
        serviceB.dependencies = [ServiceA as Dependency];

        const tokenMap = new Map([
          [ServiceA, serviceA],
          [ServiceB, serviceB],
        ]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService([ServiceA, ServiceB], mockInjector);

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

        serviceA.dependencies = [ServiceB as Dependency];
        serviceB.dependencies = [ServiceC as Dependency];
        serviceC.dependencies = [ServiceA as Dependency];

        const tokenMap = new Map([
          [ServiceA, serviceA],
          [ServiceB, serviceB],
          [ServiceC, serviceC],
        ]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService(
          [ServiceA, ServiceB, ServiceC],
          mockInjector,
        );

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
        const tokenMap = new Map([[ServiceB, serviceB]]);
        // Note: ServiceA is not in the tokenMap
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService([ServiceB], mockInjector);

        // Act & Assert
        await expect(sut.init()).rejects.toThrow(/not registered/);
      });

      it("includes dependency name and registration instructions in error when called", async () => {
        // Arrange
        class MyDependency extends TestService {}
        class MyService extends TestService {
          dependencies = [MyDependency];
        }

        const myService = new MyService();
        const tokenMap = new Map([[MyService, myService]]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService([MyService], mockInjector);

        // Act & Assert
        await expect(sut.init()).rejects.toThrow("MyService depends on MyDependency");
        await expect(sut.init()).rejects.toThrow("useValue: MyDependency");
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
        const tokenMap = new Map([[FailingService, service]]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService([FailingService], mockInjector);

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
        const tokenMap = new Map([[SyncService, service]]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService([SyncService], mockInjector);

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

        const tokenMap = new Map([
          [SyncService, syncService],
          [AsyncService, asyncService],
        ]);
        const mockInjector = createMockInjector(tokenMap);
        const sut = new DefaultDecentralizedInitService([AsyncService, SyncService], mockInjector);

        // Act
        await sut.init();

        // Assert
        expect(executionOrder).toEqual(["sync", "async"]);
      });
    });
  });
});
