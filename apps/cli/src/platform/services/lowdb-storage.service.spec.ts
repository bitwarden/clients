import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { mock } from "jest-mock-extended";
import * as FileSync from "lowdb/adapters/FileSync";
import * as lock from "proper-lockfile";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { LowdbStorageService } from "./lowdb-storage.service";

/** The backoff between lock attempts, see `retries` in the service. */
const isBackoff = (ms: number) => ms >= 100 && ms <= 250;

const lockedError = () =>
  Object.assign(new Error("Lock file is already being held"), { code: "ELOCKED" });

describe("LowdbStorageService", () => {
  let dir: string;
  let sut: LowdbStorageService;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "lowdb-storage-"));
    sut = new LowdbStorageService(mock<LogService>(), null, dir, false, true);
    await sut.init();
    await sut.save("key", "value");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("never backs off for its own lock when accessed concurrently", async () => {
    // Waiting for a lock this process holds itself stalled every CLI command by 100-250ms a time.
    const setTimeoutSpy = jest.spyOn(global, "setTimeout");

    const reads = await Promise.all(Array.from({ length: 10 }, () => sut.get("key")));

    expect(reads).toEqual(Array(10).fill("value"));
    const backoffs = setTimeoutSpy.mock.calls.filter(([, ms]) => isBackoff(ms as number));
    expect(backoffs).toHaveLength(0);
  });

  it("waits while another process holds the lock", async () => {
    const lockSync = jest.spyOn(lock, "lockSync");
    lockSync.mockImplementationOnce(() => {
      throw lockedError();
    });
    lockSync.mockImplementationOnce(() => {
      throw lockedError();
    });
    const delay = jest.spyOn(Utils, "delay").mockResolvedValue();

    await expect(sut.get("key")).resolves.toBe("value");

    expect(delay.mock.calls).toEqual([[100], [200]]);
  });

  it("gives up when another process keeps holding the lock", async () => {
    jest.spyOn(lock, "lockSync").mockImplementation(() => {
      throw lockedError();
    });
    const delay = jest.spyOn(Utils, "delay").mockResolvedValue();

    await expect(sut.get("key")).rejects.toThrow("Could not acquire the db file lock");

    expect(delay).toHaveBeenCalledTimes(50);
  });

  it("does not retry other lock errors", async () => {
    jest.spyOn(lock, "lockSync").mockImplementation(() => {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    });
    const delay = jest.spyOn(Utils, "delay").mockResolvedValue();

    await expect(sut.get("key")).rejects.toThrow("permission denied");

    expect(delay).not.toHaveBeenCalled();
  });
});

describe("LowdbStorageService read cache", () => {
  let dir: string;
  let dataFile: string;
  let service: LowdbStorageService;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "lowdb-storage-"));
    dataFile = path.join(dir, "data.json");
    service = new LowdbStorageService(mock<LogService>(), null, dir, false, true);
    await service.init();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** Writes data.json as another `bw` process would, behind this service's back. */
  const writeFromOtherProcess = (data: object) => {
    // Ensure a different mtime even on file systems with coarse timestamps.
    const future = new Date(Date.now() + 5_000);
    fs.writeFileSync(dataFile, JSON.stringify(data));
    fs.utimesSync(dataFile, future, future);
  };

  it("does not re-read data.json while it is unchanged", async () => {
    await service.save("key", { value: 1 });
    const read = jest.spyOn((service as any).db, "read");

    await service.get("key");
    await service.get("key");

    expect(read).not.toHaveBeenCalled();
  });

  it("re-reads data.json after another process changed it", async () => {
    await service.save("key", { value: 1 });

    writeFromOtherProcess({ key: { value: 2 } });

    await expect(service.get("key")).resolves.toEqual({ value: 2 });
  });

  it("does not let a caller mutate the stored value through a get", async () => {
    await service.save("key", { value: 1 });

    const first = await service.get<{ value: number }>("key");
    first.value = 99;

    await expect(service.get("key")).resolves.toEqual({ value: 1 });
  });

  it("does not let a caller mutate the stored value after a save", async () => {
    const saved = { value: 1 };
    await service.save("key", saved);

    saved.value = 99;

    await expect(service.get("key")).resolves.toEqual({ value: 1 });
  });

  it("returns what the file holds, not the saved object", async () => {
    await service.save("key", { date: new Date(0), fn: () => 1 });

    // As a re-read from disk would: dates as strings, functions dropped.
    await expect(service.get("key")).resolves.toEqual({ date: "1970-01-01T00:00:00.000Z" });
  });

  it("sees a removal by another process", async () => {
    await service.save("key", { value: 1 });

    writeFromOtherProcess({});

    await expect(service.get("key")).resolves.toBeNull();
  });

  it("sees a write by another process that lands during init", async () => {
    const racedDir = fs.mkdtempSync(path.join(os.tmpdir(), "lowdb-storage-"));
    const racedFile = path.join(racedDir, "data.json");
    const read = FileSync.prototype.read;
    let raced = false;
    // Another process writes right after init read data.json, before init recorded its version.
    jest.spyOn(FileSync.prototype, "read").mockImplementation(function (this: any) {
      const data = read.call(this);
      if (!raced) {
        raced = true;
        fs.writeFileSync(racedFile, JSON.stringify({ key: { value: 2 } }));
      }
      return data;
    });
    const racedService = new LowdbStorageService(mock<LogService>(), null, racedDir, false, true);

    try {
      await racedService.init();

      await expect(racedService.get("key")).resolves.toEqual({ value: 2 });
    } finally {
      jest.restoreAllMocks();
      fs.rmSync(racedDir, { recursive: true, force: true });
    }
  });
});
