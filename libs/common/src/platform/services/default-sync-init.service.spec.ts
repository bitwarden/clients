import { Dependency } from "../abstractions/initializable";
import { Injector } from "../abstractions/injector";
import { SyncInitializable } from "../abstractions/sync-initializable";

import { DefaultSyncInitService } from "./default-sync-init.service";

// Mock service tokens
class Service1 {}
class Service2 {}
class TestService {}

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
    const service1: SyncInitializable = {
      init: mockInit,
    };

    (mockInjector.get as jest.Mock).mockReturnValue(service1);

    const syncInitService = new DefaultSyncInitService([Service1], mockInjector);
    syncInitService.init();

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInjector.get).toHaveBeenCalledWith(Service1);
  });

  it("should initialize services in registration order", () => {
    const order: number[] = [];
    const service1: SyncInitializable = {
      init: () => order.push(1),
    };
    const service2: SyncInitializable = {
      init: () => order.push(2),
    };

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
    const service1: SyncInitializable & { constructor: { name: string } } = {
      init: () => {
        throw new Error("test error");
      },
      constructor: { name: "TestService" },
    };

    (mockInjector.get as jest.Mock).mockReturnValue(service1);

    const syncInitService = new DefaultSyncInitService([TestService], mockInjector);

    expect(() => syncInitService.init()).toThrow(
      "Failed to synchronously initialize TestService: Error: test error",
    );
  });

  it("should use 'Unknown' as service name if constructor.name is unavailable", () => {
    // Create an object with no constructor name (use Object.create(null))
    const service1 = Object.create(null);
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

    const service1: SyncInitializable & { constructor: { name: string } } = {
      init: mockInit1,
      constructor: { name: "Service1" },
    };
    const service2: SyncInitializable = {
      init: mockInit2,
    };

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

    expect(() => syncInitService.init()).toThrow("Failed to synchronously initialize Service1");
    expect(mockInit1).toHaveBeenCalledTimes(1);
    expect(mockInit2).not.toHaveBeenCalled();
  });

  it("should handle null or undefined serviceTokens", () => {
    const syncInitService = new DefaultSyncInitService(null as any, mockInjector);

    expect(() => syncInitService.init()).not.toThrow();
  });
});
