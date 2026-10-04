import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { mock } from "jest-mock-extended";
import * as lock from "proper-lockfile";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { LowdbStorageService } from "./lowdb-storage.service";

jest.mock("proper-lockfile", () => ({
  ...jest.requireActual("proper-lockfile"),
  lock: jest.fn(),
}));

describe("LowdbStorageService", () => {
  let dir: string;
  let sut: LowdbStorageService;

  // Concurrent lock attempts, i.e. ones made while this process already holds the lock.
  let held: number;
  let maxHeld: number;

  beforeEach(async () => {
    held = 0;
    maxHeld = 0;
    jest.mocked(lock.lock).mockImplementation(async () => {
      held++;
      maxHeld = Math.max(maxHeld, held);
      await new Promise((resolve) => setImmediate(resolve));
      return async () => {
        held--;
      };
    });

    dir = fs.mkdtempSync(path.join(os.tmpdir(), "lowdb-storage-"));
    sut = new LowdbStorageService(mock<LogService>(), null, dir, false, true);
    await sut.init();
    await sut.save("key", "value");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("queues concurrent reads instead of contending for its own file lock", async () => {
    // Contending makes proper-lockfile retry after 100-250ms, which stalled every CLI command.
    const reads = await Promise.all(Array.from({ length: 5 }, () => sut.get("key")));

    expect(reads).toEqual(Array(5).fill("value"));
    expect(maxHeld).toBe(1);
  });

  it("keeps serving reads after one fails", async () => {
    jest.mocked(lock.lock).mockRejectedValueOnce(new Error("lock failed"));

    await expect(sut.get("key")).rejects.toThrow("lock failed");
    await expect(sut.get("key")).resolves.toBe("value");
  });
});
