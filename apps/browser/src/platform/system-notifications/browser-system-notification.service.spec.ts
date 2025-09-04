import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonLocation,
  SystemNotificationCreateInfo,
} from "@bitwarden/common/platform/system-notifications/system-notifications.service";

import { BrowserSystemNotificationService } from "./browser-system-notification.service";

type TestChromeEvent<T extends (...args: any[]) => any> = {
  addListener: (callback: T) => void;
  removeListener: (callback: T) => void;
  // test-only helper
  emit: (...args: Parameters<T>) => void;
};

function createTestChromeEvent<T extends (...args: any[]) => any>(): TestChromeEvent<T> {
  const listeners = new Set<T>();
  return {
    addListener: jest.fn((cb: T) => listeners.add(cb)),
    removeListener: jest.fn((cb: T) => listeners.delete(cb)),
    emit: (...args: Parameters<T>) => listeners.forEach((cb) => cb(...args)),
  } as TestChromeEvent<T>;
}

describe("BrowserSystemNotificationService", () => {
  let platformUtilsService: jest.Mocked<PlatformUtilsService>;
  let service: BrowserSystemNotificationService;

  let onButtonClicked: TestChromeEvent<(notificationId: string, buttonIndex: number) => void>;
  let onClicked: TestChromeEvent<(notificationId: string) => void>;

  beforeEach(() => {
    onButtonClicked = createTestChromeEvent();
    onClicked = createTestChromeEvent();

    (global as any).chrome.notifications = {
      onButtonClicked,
      onClicked,
      create: jest.fn((idOrOptions: any, optionsOrCallback: any, callback?: any) => {
        if (typeof idOrOptions === "string") {
          const cb = callback as (id: string) => void;
          if (cb) {
            cb(idOrOptions);
          }
          return;
        }
        const cb = optionsOrCallback as (id: string) => void;
        if (cb) {
          cb("generated-id");
        }
      }),
      clear: jest.fn(),
    } as any;

    platformUtilsService = {
      getDevice: jest.fn().mockReturnValue(DeviceType.ChromeExtension),
    } as any;

    service = new BrowserSystemNotificationService(platformUtilsService);
  });

  describe("isSupported", () => {
    it("returns true when chrome.notifications exists", () => {
      expect(service.isSupported()).toBe(true);
    });

    it("returns false when chrome.notifications is missing", () => {
      const original = (global as any).chrome.notifications;
      delete (global as any).chrome.notifications;
      expect(service.isSupported()).toBe(false);
      (global as any).chrome.notifications = original;
    });
  });

  describe("create", () => {
    it("passes id and options with buttons on non-Firefox", async () => {
      const createInfo = {
        id: "notif-1",
        title: "Test Title",
        body: "Body",
        buttons: [{ title: "A" }, { title: "B" }],
      };

      let capturedId: string | undefined;
      let capturedOptions: any;
      (chrome.notifications.create as jest.Mock).mockImplementationOnce(
        (id: string, options: any, cb: (id: string) => void) => {
          capturedId = id;
          capturedOptions = options;
          cb(id);
        },
      );

      const id = await service.create(createInfo);

      expect(id).toBe("notif-1");
      expect(capturedId).toBe("notif-1");
      expect(capturedOptions.title).toBe("Test Title");
      expect(capturedOptions.message).toBe("Body");
      expect(capturedOptions.type).toBe("basic");
      expect(capturedOptions.iconUrl).toContain("images/icon128.png");
      expect(capturedOptions.buttons).toEqual([{ title: "A" }, { title: "B" }]);
    });

    it("omits buttons on Firefox", async () => {
      platformUtilsService.getDevice.mockReturnValue(DeviceType.FirefoxExtension);

      const createInfo = {
        id: "notif-2",
        title: "Title",
        body: "Body",
        buttons: [{ title: "X" }],
      };

      let capturedOptions: any;
      (chrome.notifications.create as jest.Mock).mockImplementationOnce(
        (_id: string, options: any, cb: (id: string) => void) => {
          capturedOptions = options;
          cb(_id);
        },
      );

      await service.create(createInfo);

      expect("buttons" in capturedOptions).toBe(false);
      expect(capturedOptions.title).toBe("Title");
      expect(capturedOptions.message).toBe("Body");
    });

    it("supports creating without an id", async () => {
      const createInfo: SystemNotificationCreateInfo = {
        title: "No Id",
        body: "Body",
        buttons: [],
      };

      let calledWithOptionsOnly = false;
      (chrome.notifications.create as jest.Mock).mockImplementationOnce(
        (options: any, cb: (id: string) => void) => {
          calledWithOptionsOnly = typeof options === "object" && cb != null;
          cb("generated-id");
        },
      );

      const id = await service.create(createInfo);
      expect(id).toBe("generated-id");
      expect(calledWithOptionsOnly).toBe(true);
    });
  });

  describe("clear", () => {
    it("invokes chrome.notifications.clear with the id", async () => {
      await service.clear({ id: "to-clear" });
      expect(chrome.notifications.clear).toHaveBeenCalledWith("to-clear");
    });
  });

  describe("notificationClicked$", () => {
    it("emits when a button is clicked", (done) => {
      const expectEvent = {
        id: "nid-1",
        buttonIdentifier: 1,
      };

      service.notificationClicked$.subscribe((evt) => {
        try {
          expect(evt).toEqual(expectEvent);
          done();
        } catch (e) {
          done(e);
        }
      });

      onButtonClicked.emit("nid-1", 1);
    });

    it("emits when the notification itself is clicked", (done) => {
      const expectEvent = {
        id: "nid-2",
        buttonIdentifier: ButtonLocation.NotificationButton,
      };

      service.notificationClicked$.subscribe((evt) => {
        try {
          expect(evt).toEqual(expectEvent);
          done();
        } catch (e) {
          done(e);
        }
      });

      onClicked.emit("nid-2");
    });
  });
});
