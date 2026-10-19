import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { mock } from "jest-mock-extended";
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
