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

    afterEach(() => {
      // Reset to original after each test
      setUserAgent(originalUserAgent);
    });

    test("returns DuckDuckGo browser with example User-Agent", () => {
      setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3.1 Safari/605.1.15 Ddg/18.3.1",
      );
      const result = webPlatformUtilsService.getDevice();
      expect(result).toBe(DeviceType.DuckDuckGoBrowser);
    });
  });
});
