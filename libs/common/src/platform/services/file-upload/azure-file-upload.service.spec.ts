import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "../../../abstractions/api.service";
import { ConfigService } from "../../abstractions/config/config.service";
import { UploadOptions } from "../../abstractions/file-upload/file-upload.service";
import { LogService } from "../../abstractions/log.service";
import { EncArrayBuffer } from "../../models/domain/enc-array-buffer";

import { AzureFileUploadService } from "./azure-file-upload.service";

class FakeHeaders {
  private map: Record<string, string> = {};
  constructor(init?: Record<string, string>) {
    if (init) {
      Object.assign(this.map, init);
    }
  }
  get(name: string) {
    return this.map[name] ?? null;
  }
}

class FakeRequest {
  url: string;
  options: unknown;
  constructor(url: string, options?: unknown) {
    this.url = url;
    this.options = options;
  }
}

beforeAll(() => {
  // jsdom doesn't ship Request/Headers
  (globalThis as any).Headers = FakeHeaders;
  (globalThis as any).Request = FakeRequest;
});

afterAll(() => {
  delete (globalThis as any).Headers;
  delete (globalThis as any).Request;
});

function makeUrl(expiryOffset = 3600000): string {
  const expiry = new Date(Date.now() + expiryOffset).toISOString();
  return `https://example.blob.core.windows.net/container/blob?sv=2020-08-04&se=${encodeURIComponent(expiry)}&sig=fake`;
}

/**
 * Creates a fake EncArrayBuffer large enough to trigger block upload (> 256 MiB) without
 * allocating real memory. `slice` returns an empty ArrayBuffer since network calls are mocked.
 */
function makeFakeBlockUploadData(): EncArrayBuffer {
  return {
    buffer: {
      byteLength: 256 * 1024 * 1024 + 1, // 1 byte over single blob upload limit to trigger block upload
      slice: () => new ArrayBuffer(0),
    },
  } as unknown as EncArrayBuffer;
}

describe("AzureFileUploadService", () => {
  let logService: MockProxy<LogService>;
  let apiService: MockProxy<ApiService>;
  let configService: MockProxy<ConfigService>;
  let service: AzureFileUploadService;

  const makeOkResponse = () => ({ status: 201 }) as Response;

  beforeEach(() => {
    logService = mock<LogService>();
    apiService = mock<ApiService>();
    configService = mock<ConfigService>();
    service = new AzureFileUploadService(logService, apiService, configService);
  });

  it("calls onProgress for each block via XMLHttpRequest", async () => {
    const data = makeFakeBlockUploadData();
    const url = makeUrl();
    const renewalCallback = jest.fn().mockResolvedValue(url);
    const progressValues: number[] = [];

    configService.getFeatureFlag.mockResolvedValue(true);

    // In browser mode, each block PUT uses nativeXMLHttpRequest which calls onProgress
    apiService.nativeXMLHttpRequest.mockImplementation(
      async (_req: Request, onProgress: (percentage: number) => void) => {
        onProgress(75);
        return { status: 201 } as Response;
      },
    );
    apiService.nativeFetch.mockResolvedValue(makeOkResponse()); // block list PUT

    await service.upload(url, data, renewalCallback, {
      onProgress: (p) => progressValues.push(p),
    } as UploadOptions);

    expect(progressValues).toEqual([75]);
  });

  it("calls renewalCallback when URL is near expiry", async () => {
    const data = makeFakeBlockUploadData();
    const expiredUrl = makeUrl(-5000); // expired 5 seconds ago
    const freshUrl = makeUrl(3600000);
    const renewalCallback = jest.fn().mockResolvedValue(freshUrl);

    apiService.nativeFetch.mockResolvedValue(makeOkResponse());

    await service.upload(expiredUrl, data, renewalCallback);

    expect(renewalCallback).toHaveBeenCalled();
  });

  it("throws on non-201 block PUT response", async () => {
    const data = makeFakeBlockUploadData();
    const url = makeUrl();
    const renewalCallback = jest.fn().mockResolvedValue(url);

    apiService.nativeFetch.mockResolvedValue({
      status: 403,
      json: () => Promise.resolve({ error: "Forbidden" }),
    } as Response);

    await expect(service.upload(url, data, renewalCallback)).rejects.toThrow(
      "Unsuccessful block PUT. Received status 403",
    );
  });

  it("throws on non-201 block list PUT response", async () => {
    const data = makeFakeBlockUploadData();
    const url = makeUrl();
    const renewalCallback = jest.fn().mockResolvedValue(url);

    apiService.nativeFetch
      .mockResolvedValueOnce(makeOkResponse()) // block PUT succeeds
      .mockResolvedValueOnce({
        status: 500,
        json: () => Promise.resolve({ error: "Internal Server Error" }),
      } as Response); // block list PUT fails

    await expect(service.upload(url, data, renewalCallback)).rejects.toThrow(
      "Unsuccessful block list PUT. Received status 500",
    );
  });
});
