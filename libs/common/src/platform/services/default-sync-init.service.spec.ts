import { Dependency } from "../abstractions/initializable";
import { Injector } from "../abstractions/injector";
import { SyncInitializable } from "../abstractions/sync-initializable";

import { DefaultSyncInitService } from "./default-sync-init.service";

// Mock service base class
class MockSyncService implements SyncInitializable {
  dependencies?: Dependency[] = [];
  initCalled = false;

  init(): void {
    this.initCalled = true;
  }
}

// Mock service tokens (abstract classes used as tokens)
abstract class Service1 extends MockSyncService {}
abstract class Service2 extends MockSyncService {}
abstract class Service3 extends MockSyncService {}
abstract class TestService extends MockSyncService {}

describe("DefaultSyncInitService", () => {
  let mockInjector: Injector;

  beforeEach(() => {
    mockInjector = {
      get: jest.fn(),
    } as any;
  });

  it("should handle empty service list without error", () => {
    const syncInitService = new DefaultSyncInitService([], mockInjector);

    expect(() => syncInitService.init()).not.toThrow();
  });

  it("should initialize a single service", () => {
    const mockInit = jest.fn();
    class TestService1 extends Service1 {
      init = mockInit;
    }
    const service1 = new TestService1();

    (mockInjector.get as jest.Mock).mockReturnValue(service1);

    const syncInitService = new DefaultSyncInitService([Service1], mockInjector);
    syncInitService.init();

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInjector.get).toHaveBeenCalledWith(Service1);
  });

  it("should initialize services in registration order", () => {
    const order: number[] = [];
    class TestService1 extends Service1 {
      init = () => order.push(1);
    }
    class TestService2 extends Service2 {
      init = () => order.push(2);
    }
    const service1 = new TestService1();
    const service2 = new TestService2();

    (mockInjector.get as jest.Mock).mockImplementation((token: Dependency) => {
      if (token === Service1) {
        return service1;
      }
      if (token === Service2) {
        return service2;
      }
      return null;
    });

    const syncInitService = new DefaultSyncInitService([Service1, Service2], mockInjector);
    syncInitService.init();

    expect(order).toEqual([1, 2]);
  });

  it("should throw error with service name on failure", () => {
    class FailingService extends TestService {
      init = () => {
        throw new Error("test error");
      };
    }
    const service1 = new FailingService();

    (mockInjector.get as jest.Mock).mockReturnValue(service1);

    const syncInitService = new DefaultSyncInitService([TestService], mockInjector);

    expect(() => syncInitService.init()).toThrow(
      "Failed to synchronously initialize FailingService: Error: test error",
    );
  });

  it("should use 'Unknown' as service name if constructor.name is unavailable", () => {
    // Create an object with no constructor name (use Object.create(null))
    const service1 = Object.create(null) as SyncInitializable;
    service1.init = () => {
      throw new Error("test error");
    };

    (mockInjector.get as jest.Mock).mockReturnValue(service1);

    const syncInitService = new DefaultSyncInitService([TestService], mockInjector);

    expect(() => syncInitService.init()).toThrow(
      "Failed to synchronously initialize Unknown: Error: test error",
    );
  });

  it("should stop initialization on first error", () => {
    const mockInit1 = jest.fn(() => {
      throw new Error("first error");
    });
    const mockInit2 = jest.fn();

    class FailingService1 extends Service1 {
      init = mockInit1;
    }
    class TestService2 extends Service2 {
      init = mockInit2;
    }
    const service1 = new FailingService1();
    const service2 = new TestService2();

    (mockInjector.get as jest.Mock).mockImplementation((token: Dependency) => {
      if (token === Service1) {
        return service1;
      }
      if (token === Service2) {
        return service2;
      }
      return null;
    });

    const syncInitService = new DefaultSyncInitService([Service1, Service2], mockInjector);

    expect(() => syncInitService.init()).toThrow(
      "Failed to synchronously initialize FailingService1",
    );
    expect(mockInit1).toHaveBeenCalledTimes(1);
    expect(mockInit2).not.toHaveBeenCalled();
  });

  it("should handle null or undefined serviceTokens", () => {
    const syncInitService = new DefaultSyncInitService(null as any, mockInjector);

    expect(() => syncInitService.init()).not.toThrow();
  });

  it("should initialize services in dependency order", () => {
    const order: number[] = [];

    class TestService1 extends Service1 {
      dependencies: Dependency[] = [];
      init = () => order.push(1);
    }

    class TestService2 extends Service2 {
      dependencies = [Service1]; // Service2 depends on Service1
      init = () => order.push(2);
    }

    const service1 = new TestService1();
    const service2 = new TestService2();

    (mockInjector.get as jest.Mock).mockImplementation((token: Dependency) => {
      if (token === Service1) {
        return service1;
      }
      if (token === Service2) {
        return service2;
      }
      return null;
    });

    const syncInitService = new DefaultSyncInitService([Service1, Service2], mockInjector);
    syncInitService.init();

    // Service1 should run before Service2
    expect(order).toEqual([1, 2]);
  });

  it("should handle reverse registration order with dependencies", () => {
    const order: number[] = [];

    class TestService1 extends Service1 {
      init = () => order.push(1);
    }

    class TestService2 extends Service2 {
      dependencies = [Service1];
      init = () => order.push(2);
    }

    const service1 = new TestService1();
    const service2 = new TestService2();

    (mockInjector.get as jest.Mock).mockImplementation((token: Dependency) => {
      if (token === Service1) {
        return service1;
      }
      if (token === Service2) {
        return service2;
      }
      return null;
    });

    // Registered in reverse order, but should still execute in dependency order
    const syncInitService = new DefaultSyncInitService([Service2, Service1], mockInjector);
    syncInitService.init();

    expect(order).toEqual([1, 2]);
  });

  it("should detect circular dependencies", () => {
    class TestService1 extends Service1 {
      dependencies = [Service2];
      init = () => {};
    }

    class TestService2 extends Service2 {
      dependencies = [Service1];
      init = () => {};
    }

    const service1 = new TestService1();
    const service2 = new TestService2();

    (mockInjector.get as jest.Mock).mockImplementation((token: Dependency) => {
      if (token === Service1) {
        return service1;
      }
      if (token === Service2) {
        return service2;
      }
      return null;
    });

    const syncInitService = new DefaultSyncInitService([Service1, Service2], mockInjector);

    expect(() => syncInitService.init()).toThrow(/Circular dependency detected/);
  });

  it("should throw error for missing dependency", () => {
    class TestService1 extends Service1 {
      dependencies = [Service2]; // Service2 not registered
      init = () => {};
    }

    const service1 = new TestService1();

    (mockInjector.get as jest.Mock).mockImplementation((token: Dependency) => {
      if (token === Service1) {
        return service1;
      }
      return null; // Service2 not found
    });

    const syncInitService = new DefaultSyncInitService([Service1], mockInjector);

    expect(() => syncInitService.init()).toThrow(/depends on.*but.*is not registered/);
  });

  it("should handle complex dependency chains", () => {
    const order: number[] = [];

    class TestService1 extends Service1 {
      dependencies: Dependency[] = [];
      init = () => order.push(1);
    }

    class TestService2 extends Service2 {
      dependencies = [Service1];
      init = () => order.push(2);
    }

    class TestService3 extends Service3 {
      dependencies = [Service2];
      init = () => order.push(3);
    }

    const service1 = new TestService1();
    const service2 = new TestService2();
    const service3 = new TestService3();

    (mockInjector.get as jest.Mock).mockImplementation((token: Dependency) => {
      if (token === Service1) {
        return service1;
      }
      if (token === Service2) {
        return service2;
      }
      if (token === Service3) {
        return service3;
      }
      return null;
    });

    // Register in arbitrary order
    const syncInitService = new DefaultSyncInitService(
      [Service3, Service1, Service2],
      mockInjector,
    );
    syncInitService.init();

    // Should execute in dependency order: 1, 2, 3
    expect(order).toEqual([1, 2, 3]);
  });
});
