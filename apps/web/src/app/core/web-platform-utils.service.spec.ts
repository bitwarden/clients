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

    afterEach(() => {
      // Reset to original after each test
      setUserAgent(originalUserAgent);
    });

    const testData: {
      userAgent: string;
      expectedDevice: DeviceType;
      windowProps?: Record<string, any>;
    }[] = [
      {
        // DuckDuckGo macoOS browser v1.13
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3.1 Safari/605.1.15 Ddg/18.3.1",
        expectedDevice: DeviceType.DuckDuckGoBrowser,
      },
      // DuckDuckGo Windows browser v0.109.7, which does not present the Ddg suffix and is therefore detected as Edge
      {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
        expectedDevice: DeviceType.EdgeBrowser,
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
      ({ userAgent, expectedDevice, windowProps }) => {
        setUserAgent(userAgent);
        setWindowProperties(windowProps);
        const result = webPlatformUtilsService.getDevice();
        expect(result).toBe(expectedDevice);
      },
    );
  });
});
