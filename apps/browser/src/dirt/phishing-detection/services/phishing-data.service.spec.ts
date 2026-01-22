import { MockProxy, mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DefaultTaskSchedulerService,
  TaskSchedulerService,
} from "@bitwarden/common/platform/scheduling";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { LogService } from "@bitwarden/logging";

import {
  PhishingDataService,
  PHISHING_DOMAINS_META_KEY,
  PHISHING_DOMAINS_BLOB_KEY,
  PhishingDataMeta,
  PhishingDataBlob,
} from "./phishing-data.service";

const flushPromises = () =>
  new Promise((resolve) => jest.requireActual("timers").setImmediate(resolve));

// [FIXME] Move mocking and compression helpers to a shared test utils library
// to separate from phishing data service tests.
export const setupPhishingMocks = (mockedResult: string | ArrayBuffer = "mocked-data") => {
  // Store original globals
  const originals = {
    Response: global.Response,
    CompressionStream: global.CompressionStream,
    DecompressionStream: global.DecompressionStream,
    Blob: global.Blob,
    atob: global.atob,
    btoa: global.btoa,
  };

  //  Mock missing or browser-only globals
  global.atob = (str) => Buffer.from(str, "base64").toString("binary");
  global.btoa = (str) => Buffer.from(str, "binary").toString("base64");

  (global as any).CompressionStream = class {};
  (global as any).DecompressionStream = class {};

  global.Blob = class {
    constructor(public parts: any[]) {}
    stream() {
      return { pipeThrough: () => ({}) };
    }
  } as any;

  global.Response = class {
    body = { pipeThrough: () => ({}) };
    // Return string for decompression
    text() {
      return Promise.resolve(typeof mockedResult === "string" ? mockedResult : "");
    }
    // Return ArrayBuffer for compression
    arrayBuffer() {
      if (typeof mockedResult === "string") {
        const bytes = new TextEncoder().encode(mockedResult);
        return Promise.resolve(bytes.buffer);
      }

      return Promise.resolve(mockedResult);
    }
  } as any;

  // Cleanup function
  return () => {
    Object.assign(global, originals);
  };
};

describe("PhishingDataService", () => {
  let service: PhishingDataService;
  let apiService: MockProxy<ApiService>;
  let taskSchedulerService: TaskSchedulerService;
  let logService: MockProxy<LogService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  const fakeGlobalStateProvider: FakeGlobalStateProvider = new FakeGlobalStateProvider();

  const setMockMeta = (state: PhishingDataMeta) => {
    fakeGlobalStateProvider.getFake(PHISHING_DOMAINS_META_KEY).stateSubject.next(state);
    return state;
  };
  const setMockBlob = (state: PhishingDataBlob) => {
    fakeGlobalStateProvider.getFake(PHISHING_DOMAINS_BLOB_KEY).stateSubject.next(state);
    return state;
  };

  let fetchChecksumSpy: jest.SpyInstance;
  let fetchAndCompressSpy: jest.SpyInstance;

  const mockMeta: PhishingDataMeta = {
    checksum: "abc",
    timestamp: Date.now(),
    applicationVersion: "1.0.0",
  };
  const mockBlob = "http://phish.com\nhttps://badguy.net";
  const mockCompressedBlob =
    "H4sIAAAAAAAA/8vMTSzJzM9TSE7MLchJLElVyE9TyC9KSS1S0FFIz8hLz0ksSQUAtK7XMSYAAAA=";

  beforeEach(async () => {
    jest.useFakeTimers();
    apiService = mock<ApiService>();
    logService = mock<LogService>();

    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.0");

    taskSchedulerService = new DefaultTaskSchedulerService(logService);

    service = new PhishingDataService(
      apiService,
      taskSchedulerService,
      fakeGlobalStateProvider,
      logService,
      platformUtilsService,
    );
    fetchChecksumSpy = jest.spyOn(service as any, "fetchPhishingChecksum");
    fetchAndCompressSpy = jest.spyOn(service as any, "fetchAndCompress");

    fetchChecksumSpy.mockResolvedValue("new-checksum");
    fetchAndCompressSpy.mockResolvedValue("compressed-blob");
  });

  describe("initialization", () => {
    beforeEach(() => {
      jest.spyOn(service as any, "_compressString").mockResolvedValue(mockCompressedBlob);
      jest.spyOn(service as any, "_decompressString").mockResolvedValue(mockBlob);
    });

    it("should perform background update", async () => {
      platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.x");
      jest
        .spyOn(service as any, "getNextWebAddresses")
        .mockResolvedValue({ meta: mockMeta, blob: mockBlob });

      setMockBlob(mockBlob);
      setMockMeta(mockMeta);

      const sub = service.update$.subscribe();
      await flushPromises();

      const url = new URL("http://phish.com");
      const QAurl = new URL("http://phishing.testcategory.com");
      expect(await service.isPhishingWebAddress(url)).toBe(true);
      expect(await service.isPhishingWebAddress(QAurl)).toBe(true);

      sub.unsubscribe();
    });
  });

  describe("isPhishingWebAddress", () => {
    beforeEach(() => {
      jest.spyOn(service as any, "_compressString").mockResolvedValue(mockCompressedBlob);
      jest.spyOn(service as any, "_decompressString").mockResolvedValue(mockBlob);
    });

    it("should detect a phishing web address", async () => {
      service["_webAddressesSet"] = new Set(["phish.com", "badguy.net"]);

      const url = new URL("http://phish.com");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(true);
    });

    it("should not detect a safe web address", async () => {
      service["_webAddressesSet"] = new Set(["phish.com", "badguy.net"]);
      const url = new URL("http://safe.com");
      const result = await service.isPhishingWebAddress(url);
      expect(result).toBe(false);
    });

    it("should match against root web address", async () => {
      service["_webAddressesSet"] = new Set(["phish.com", "badguy.net"]);
      const url = new URL("http://phish.com/about");
      const result = await service.isPhishingWebAddress(url);
      expect(result).toBe(true);
    });

    it("should not error on empty state", async () => {
      service["_webAddressesSet"] = null;
      const url = new URL("http://phish.com/about");
      const result = await service.isPhishingWebAddress(url);
      expect(result).toBe(false);
    });
  });

  describe("getNextWebAddresses", () => {
    beforeEach(() => {
      jest.spyOn(service as any, "_compressString").mockResolvedValue(mockCompressedBlob);
      jest.spyOn(service as any, "_decompressString").mockResolvedValue(mockBlob);
    });

    it("refetches all web addresses if applicationVersion has changed", async () => {
      const prev: PhishingDataMeta = {
        timestamp: Date.now() - 60000,
        checksum: "old",
        applicationVersion: "1.0.0",
      };
      fetchChecksumSpy.mockResolvedValue("new");
      platformUtilsService.getApplicationVersion.mockResolvedValue("2.0.0");

      const result = await service.getNextWebAddresses(prev);

      expect(result!.blob).toBe("compressed-blob");
      expect(result!.meta!.checksum).toBe("new");
      expect(result!.meta!.applicationVersion).toBe("2.0.0");
    });

    it("returns null when checksum matches and cache not expired", async () => {
      const prev: PhishingDataMeta = {
        timestamp: Date.now(),
        checksum: "abc",
        applicationVersion: "1.0.0",
      };
      fetchChecksumSpy.mockResolvedValue("abc");
      const result = await service.getNextWebAddresses(prev);
      expect(result).toBeNull();
    });

    it("patches daily domains when cache is expired and checksum unchanged", async () => {
      const prev: PhishingDataMeta = {
        timestamp: 0,
        checksum: "old",
        applicationVersion: "1.0.0",
      };
      const dailyLines = ["b.com", "c.com"];
      fetchChecksumSpy.mockResolvedValue("old");
      jest.spyOn(service as any, "fetchText").mockResolvedValue(dailyLines);

      setMockBlob(mockBlob);

      const expectedBlob =
        "H4sIAAAAAAAA/8vMTSzJzM9TSE7MLchJLElVyE9TyC9KSS1S0FFIz8hLz0ksSQUAtK7XMSYAAAA=";
      const result = await service.getNextWebAddresses(prev);

      expect(result!.blob).toBe(expectedBlob);
      expect(result!.meta!.checksum).toBe("old");
    });

    it("fetches all domains when checksum has changed", async () => {
      const prev: PhishingDataMeta = {
        timestamp: 0,
        checksum: "old",
        applicationVersion: "1.0.0",
      };
      fetchChecksumSpy.mockResolvedValue("new");
      fetchAndCompressSpy.mockResolvedValue("new-blob");
      const result = await service.getNextWebAddresses(prev);
      expect(result!.blob).toBe("new-blob");
      expect(result!.meta!.checksum).toBe("new");
    });
  });

  describe("compression helpers", () => {
    let restore: () => void;

    beforeEach(async () => {
      restore = setupPhishingMocks("abc");
    });

    afterEach(() => {
      if (restore) {
        restore();
      }
      delete (Uint8Array as any).fromBase64;
      jest.restoreAllMocks();
    });

    describe("_compressString", () => {
      it("compresses a string to base64", async () => {
        const out = await service["_compressString"]("abc");
        expect(out).toBe("YWJj"); // base64 for 'abc'
      });

      it("compresses using fallback on older browsers", async () => {
        const input = "abc";
        const expected = btoa(encodeURIComponent(input));
        const out = await service["_compressString"](input);
        expect(out).toBe(expected);
      });

      it("compresses using btoa on error", async () => {
        const input = "abc";
        const expected = btoa(encodeURIComponent(input));
        const out = await service["_compressString"](input);
        expect(out).toBe(expected);
      });
    });
    describe("_decompressString", () => {
      it("decompresses a string from base64", async () => {
        const base64 = btoa("ignored");
        const out = await service["_decompressString"](base64);
        expect(out).toBe("abc");
      });

      it("decompresses using fallback on older browsers", async () => {
        // Provide a fromBase64 implementation
        (Uint8Array as any).fromBase64 = (b64: string) => new Uint8Array([100, 101, 102]);

        const out = await service["_decompressString"]("ignored");
        expect(out).toBe("abc");
      });

      it("decompresses using atob on error", async () => {
        const base64 = btoa(encodeURIComponent("abc"));
        const out = await service["_decompressString"](base64);
        expect(out).toBe("abc");
      });
    });
  });

  describe("_loadBlobToMemory", () => {
    it("loads blob into memory set", async () => {
      const prevBlob = "ignored-base64";
      fakeGlobalStateProvider.getFake(PHISHING_DOMAINS_BLOB_KEY).stateSubject.next(prevBlob);

      jest.spyOn(service as any, "_decompressString").mockResolvedValue("phish.com\nbadguy.net");

      // Trigger the load pipeline and allow async RxJS processing to complete
      service["_loadBlobToMemory"]();
      await flushPromises();

      const set = service["_webAddressesSet"] as Set<string>;
      expect(set).toBeDefined();
      expect(set.has("phish.com")).toBe(true);
      expect(set.has("badguy.net")).toBe(true);
    });
  });
});
