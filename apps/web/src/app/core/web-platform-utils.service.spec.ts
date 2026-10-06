// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DeviceType } from "@bitwarden/common/enums";

import { WebPlatformUtilsService } from "./web-platform-utils.service";

describe("Web Platform Utils Service", () => {
  let webPlatformUtilsService: WebPlatformUtilsService;

  beforeEach(() => {
    webPlatformUtilsService = new WebPlatformUtilsService(null, null, null);
  });

  afterEach(() => {
    delete process.env.APPLICATION_VERSION;
  });

  describe("getApplicationVersion", () => {
    test("null", async () => {
      delete process.env.APPLICATION_VERSION;

      const result = await webPlatformUtilsService.getApplicationVersion();
      expect(result).toBe("-");
    });

    test("<empty>", async () => {
      process.env.APPLICATION_VERSION = "";

      const result = await webPlatformUtilsService.getApplicationVersion();
      expect(result).toBe("-");
    });

    test("{version number}", async () => {
      process.env.APPLICATION_VERSION = "2022.10.2";

      const result = await webPlatformUtilsService.getApplicationVersion();
      expect(result).toBe("2022.10.2");
    });

    test("{version number} - {git hash}", async () => {
      process.env.APPLICATION_VERSION = "2022.10.2 - 5f8c1c1";

      const result = await webPlatformUtilsService.getApplicationVersion();
      expect(result).toBe("2022.10.2 - 5f8c1c1");
    });

    test("{version number}-{git hash}", async () => {
      process.env.APPLICATION_VERSION = "2022.10.2-5f8c1c1";

      const result = await webPlatformUtilsService.getApplicationVersion();
      expect(result).toBe("2022.10.2-5f8c1c1");
    });

    test("{version number} + {git hash}", async () => {
      process.env.APPLICATION_VERSION = "2022.10.2 + 5f8c1c1";

      const result = await webPlatformUtilsService.getApplicationVersion();
      expect(result).toBe("2022.10.2 + 5f8c1c1");
    });

    test("{version number}+{git hash}", async () => {
      process.env.APPLICATION_VERSION = "2022.10.2+5f8c1c1";

      const result = await webPlatformUtilsService.getApplicationVersion();
      expect(result).toBe("2022.10.2+5f8c1c1");
    });
  });

  describe("getApplicationVersionNumber", () => {
    test("null", async () => {
      delete process.env.APPLICATION_VERSION;

      const result = await webPlatformUtilsService.getApplicationVersionNumber();
      expect(result).toBe("");
    });

    test("<empty>", async () => {
      process.env.APPLICATION_VERSION = "";

      const result = await webPlatformUtilsService.getApplicationVersionNumber();
      expect(result).toBe("");
    });

    test("{version number}", async () => {
      process.env.APPLICATION_VERSION = "2022.10.2";

      const result = await webPlatformUtilsService.getApplicationVersionNumber();
      expect(result).toBe("2022.10.2");
    });

    test("{version number} - {git hash}", async () => {
      process.env.APPLICATION_VERSION = "2022.10.2 - 5f8c1c1";

      const result = await webPlatformUtilsService.getApplicationVersionNumber();
      expect(result).toBe("2022.10.2");
    });

    test("{version number}-{git hash}", async () => {
      process.env.APPLICATION_VERSION = "2022.10.2-5f8c1c1";

      const result = await webPlatformUtilsService.getApplicationVersionNumber();
      expect(result).toBe("2022.10.2");
    });

    test("{version number} + {git hash}", async () => {
      process.env.APPLICATION_VERSION = "2022.10.2 + 5f8c1c1";

      const result = await webPlatformUtilsService.getApplicationVersionNumber();
      expect(result).toBe("2022.10.2");
    });

    test("{version number}+{git hash}", async () => {
      process.env.APPLICATION_VERSION = "2022.10.2+5f8c1c1";

      const result = await webPlatformUtilsService.getApplicationVersionNumber();
      expect(result).toBe("2022.10.2");
    });
  });
  describe("getDevice", () => {
    const originalUserAgent = navigator.userAgent;

    const setUserAgent = (userAgent: string) => {
      Object.defineProperty(navigator, "userAgent", {
        value: userAgent,
        configurable: true,
      });
    };

    const setWindowProperties = (props?: Record<string, any>) => {
      if (!props) {
        return;
      }
      Object.keys(props).forEach((key) => {
        Object.defineProperty(window, key, {
          value: props[key],
          configurable: true,
        });
      });
    };

    const setUserAgentData = (userAgentData?: unknown) => {
      Object.defineProperty(navigator, "userAgentData", {
        value: userAgentData,
        configurable: true,
      });
    };

    afterEach(() => {
      // Reset to original after each test
      setUserAgent(originalUserAgent);
      delete (navigator as any).userAgentData;
    });

    const testData: {
      userAgent: string;
      expectedDevice: DeviceType;
      windowProps?: Record<string, any>;
      userAgentData?: unknown;
    }[] = [
      {
        // DuckDuckGo macoOS browser v1.13. The macOS build is WebKit-based and exposes no
        // userAgentData, so the Ddg user agent suffix is the only available signal.
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3.1 Safari/605.1.15 Ddg/18.3.1",
        expectedDevice: DeviceType.DuckDuckGoBrowser,
      },
      {
        // DuckDuckGo Windows browser v0.109.7. Its user agent carries an Edg/ suffix and no
        // Ddg suffix, so the userAgentData brand list is what distinguishes it from Edge.
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
        userAgentData: {
          brands: [
            { brand: "Not=A?Brand", version: "99" },
            { brand: "DuckDuckGo", version: "151" },
            { brand: "Chromium", version: "151" },
          ],
        },
        expectedDevice: DeviceType.DuckDuckGoBrowser,
      },
      {
        // Regression guard: a brand list without a DuckDuckGo entry must not be claimed by
        // the DuckDuckGo check, even though it also contains Chromium.
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
        userAgentData: {
          brands: [
            { brand: "Not=A?Brand", version: "99" },
            { brand: "Chromium", version: "135" },
            { brand: "Microsoft Edge", version: "135" },
          ],
        },
        expectedDevice: DeviceType.EdgeBrowser,
      },
      {
        // Regression guard: userAgentData present but without a brand list must not throw.
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        userAgentData: {},
        expectedDevice: DeviceType.ChromeBrowser,
        windowProps: { chrome: {} },
      },
      {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        expectedDevice: DeviceType.ChromeBrowser,
        windowProps: { chrome: {} }, // set window.chrome = {} to simulate Chrome
      },
      {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
        expectedDevice: DeviceType.FirefoxBrowser,
      },
      {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
        expectedDevice: DeviceType.SafariBrowser,
      },
      {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/120.0.0.0 Chrome/120.0.0.0 Safari/537.36",
        expectedDevice: DeviceType.EdgeBrowser,
      },
      {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.5481.65 Safari/537.36 OPR/95.0.4635.46",
        expectedDevice: DeviceType.OperaBrowser,
      },
      {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.57 Safari/537.36 Vivaldi/6.5.3206.48",
        expectedDevice: DeviceType.VivaldiBrowser,
      },
    ];

    test.each(testData)(
      "returns $expectedDevice for User-Agent: $userAgent",
      ({ userAgent, expectedDevice, windowProps, userAgentData }) => {
        setUserAgent(userAgent);
        setUserAgentData(userAgentData);
        setWindowProperties(windowProps);
        const result = webPlatformUtilsService.getDevice();
        expect(result).toBe(expectedDevice);
      },
    );
  });

  describe("isChromium", () => {
    const originalUserAgent = navigator.userAgent;

    const setUserAgent = (userAgent: string) => {
      Object.defineProperty(navigator, "userAgent", {
        value: userAgent,
        configurable: true,
      });
    };

    const chromiumDevices = [
      DeviceType.ChromeBrowser,
      DeviceType.EdgeBrowser,
      DeviceType.OperaBrowser,
      DeviceType.VivaldiBrowser,
    ];

    const nonChromiumDevices = [
      DeviceType.FirefoxBrowser,
      DeviceType.SafariBrowser,
      DeviceType.IEBrowser,
      DeviceType.UnknownBrowser,
    ];

    afterEach(() => {
      jest.restoreAllMocks();
      setUserAgent(originalUserAgent);
    });

    test.each(chromiumDevices)("returns true when getDevice() is %s", (deviceType) => {
      jest.spyOn(webPlatformUtilsService, "getDevice").mockReturnValue(deviceType);
      expect(webPlatformUtilsService.isChromium()).toBe(true);
    });

    test.each(nonChromiumDevices)("returns false when getDevice() is %s", (deviceType) => {
      jest.spyOn(webPlatformUtilsService, "getDevice").mockReturnValue(deviceType);
      expect(webPlatformUtilsService.isChromium()).toBe(false);
    });

    // DuckDuckGo is the one browser whose engine depends on the platform: Chromium on
    // Windows, WebKit on macOS.
    it("returns true for DuckDuckGo on Windows", () => {
      jest
        .spyOn(webPlatformUtilsService, "getDevice")
        .mockReturnValue(DeviceType.DuckDuckGoBrowser);
      setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
      );

      expect(webPlatformUtilsService.isChromium()).toBe(true);
    });

    it("returns false for DuckDuckGo on macOS", () => {
      jest
        .spyOn(webPlatformUtilsService, "getDevice")
        .mockReturnValue(DeviceType.DuckDuckGoBrowser);
      setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3.1 Safari/605.1.15 Ddg/18.3.1",
      );

      expect(webPlatformUtilsService.isChromium()).toBe(false);
    });
  });
});
