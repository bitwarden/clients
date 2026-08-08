import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { LowdbStorageService } from "./lowdb-storage.service";

describe("LowdbStorageService", () => {
  let tempDir: string;
  let dataFilePath: string;
  let logService: MockProxy<LogService>;
  let sut: LowdbStorageService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lowdb-test-"));
    dataFilePath = path.join(tempDir, "data.json");
    logService = mock<LogService>();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function makeSut(overrides?: {
    defaults?: any;
    dir?: string;
    allowCache?: boolean;
    requireLock?: boolean;
  }) {
    return new LowdbStorageService(
      logService,
      overrides?.defaults ?? null,
      overrides?.dir ?? tempDir,
      overrides?.allowCache ?? false,
      overrides?.requireLock ?? true,
    );
  }

  describe("init", () => {
    it("creates a missing directory", async () => {
      const newDir = path.join(tempDir, "nested", "leaf");
      sut = makeSut({ dir: newDir });

      await sut.init();

      expect(fs.existsSync(newDir)).toBe(true);
    });

    it("creates data.json when it does not exist", async () => {
      sut = makeSut();

      await sut.init();

      expect(fs.existsSync(dataFilePath)).toBe(true);
    });

    // POSIX-only: Windows does not honor chmod bits.
    const posixIt = process.platform === "win32" ? it.skip : it;
    posixIt("creates data.json with 0600 permissions", async () => {
      sut = makeSut();

      await sut.init();

      const mode = fs.statSync(dataFilePath).mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it("is idempotent when called twice", async () => {
      sut = makeSut();

      await sut.init();
      await sut.init();

      // Second init must not clobber saved state.
      await sut.save("key", "value");
      expect(await sut.get("key")).toBe("value");
    });

    it("writes defaults on first init", async () => {
      sut = makeSut({ defaults: { server: "https://vault.bitwarden.com" } });

      await sut.init();

      expect(await sut.get("server")).toBe("https://vault.bitwarden.com");
    });

    it("does not overwrite existing keys with defaults on subsequent init", async () => {
      fs.writeFileSync(dataFilePath, JSON.stringify({ server: "https://custom.example" }));
      sut = makeSut({ defaults: { server: "https://vault.bitwarden.com" } });

      await sut.init();

      expect(await sut.get("server")).toBe("https://custom.example");
    });

    it("adds new default keys without touching existing ones", async () => {
      fs.writeFileSync(dataFilePath, JSON.stringify({ existing: "keep" }));
      sut = makeSut({ defaults: { existing: "clobbered", added: "new" } });

      await sut.init();

      expect(await sut.get("existing")).toBe("keep");
      expect(await sut.get("added")).toBe("new");
    });
  });

  describe("corrupt-file recovery", () => {
    it("recovers from invalid JSON and yields a usable service", async () => {
      fs.writeFileSync(dataFilePath, "{ not json");
      sut = makeSut();

      await sut.init();

      await sut.save("key", "value");
      expect(await sut.get("key")).toBe("value");
    });

    it("backs up the corrupt file to <dataFilePath>.bak", async () => {
      const corrupt = "{ not json";
      fs.writeFileSync(dataFilePath, corrupt);
      sut = makeSut();

      await sut.init();

      expect(fs.readFileSync(dataFilePath + ".bak", "utf-8")).toBe(corrupt);
    });

    it("treats an empty (zero-byte) file as an empty database, not corruption", async () => {
      fs.writeFileSync(dataFilePath, "");
      sut = makeSut();

      await sut.init();
      await sut.save("key", "value");

      expect(await sut.get("key")).toBe("value");
    });
  });

  describe("save and get", () => {
    beforeEach(async () => {
      sut = makeSut();
      await sut.init();
    });

    it("round-trips a string value", async () => {
      await sut.save("k", "value");

      expect(await sut.get("k")).toBe("value");
    });

    it("round-trips an object", async () => {
      const obj = { a: 1, b: "two", c: { nested: true } };

      await sut.save("obj", obj);

      expect(await sut.get("obj")).toEqual(obj);
    });

    it("round-trips an array", async () => {
      const arr = [1, "two", { three: 3 }];

      await sut.save("arr", arr);

      expect(await sut.get("arr")).toEqual(arr);
    });

    it("returns null for missing keys", async () => {
      expect(await sut.get("nonexistent")).toBeNull();
    });

    it("overwrites an existing value", async () => {
      await sut.save("k", "first");
      await sut.save("k", "second");

      expect(await sut.get("k")).toBe("second");
    });

    it("persists writes to disk before save() resolves", async () => {
      await sut.save("k", "on-disk");

      const raw = JSON.parse(fs.readFileSync(dataFilePath, "utf-8"));
      expect(raw.k).toBe("on-disk");
    });

    it("treats dotted keys as literal top-level keys", async () => {
      await sut.save("a.b", "literal");

      const raw = JSON.parse(fs.readFileSync(dataFilePath, "utf-8"));
      expect(raw["a.b"]).toBe("literal");
      expect(raw.a).toBeUndefined();
      expect(await sut.get("a.b")).toBe("literal");
    });
  });

  describe("cross-instance persistence", () => {
    it("a fresh instance reads state written by a prior instance", async () => {
      const first = makeSut();
      await first.init();
      await first.save("k", "persisted");

      const second = makeSut();
      await second.init();

      expect(await second.get("k")).toBe("persisted");
    });
  });

  describe("has", () => {
    beforeEach(async () => {
      sut = makeSut();
      await sut.init();
    });

    it("returns true for a saved key", async () => {
      await sut.save("k", "value");

      expect(await sut.has("k")).toBe(true);
    });

    it("returns false for a missing key", async () => {
      expect(await sut.has("nonexistent")).toBe(false);
    });

    it("returns false after remove", async () => {
      await sut.save("k", "value");
      await sut.remove("k");

      expect(await sut.has("k")).toBe(false);
    });
  });

  describe("remove", () => {
    beforeEach(async () => {
      sut = makeSut();
      await sut.init();
    });

    it("removes an existing key", async () => {
      await sut.save("k", "value");

      await sut.remove("k");

      expect(await sut.get("k")).toBeNull();
    });

    it("is a no-op for a missing key", async () => {
      await expect(sut.remove("nonexistent")).resolves.not.toThrow();
    });

    it("persists the removal to disk", async () => {
      await sut.save("k", "value");

      await sut.remove("k");

      const raw = JSON.parse(fs.readFileSync(dataFilePath, "utf-8"));
      expect(raw.k).toBeUndefined();
    });
  });

  describe("updates$", () => {
    beforeEach(async () => {
      sut = makeSut();
      await sut.init();
    });

    it("emits { key, updateType: 'save' } after save", async () => {
      const next = firstValueFrom(sut.updates$);

      await sut.save("k", "value");

      await expect(next).resolves.toEqual({ key: "k", updateType: "save" });
    });

    it("emits { key, updateType: 'remove' } after remove", async () => {
      await sut.save("k", "value");
      const next = firstValueFrom(sut.updates$);

      await sut.remove("k");

      await expect(next).resolves.toEqual({ key: "k", updateType: "remove" });
    });

    it("does not emit on get", async () => {
      await sut.save("k", "value");
      let emitted = false;
      const sub = sut.updates$.subscribe(() => (emitted = true));

      await sut.get("k");

      sub.unsubscribe();
      expect(emitted).toBe(false);
    });

    // Guards against a class of bug where the update event fires before the
    // write has been flushed. Subscribers acting on updates$ must be able to
    // read the new value from any source (including disk) synchronously.
    it("emits after the write has been persisted to disk", async () => {
      let onDiskAtEmit: any = null;
      const sub = sut.updates$.subscribe(() => {
        onDiskAtEmit = JSON.parse(fs.readFileSync(dataFilePath, "utf-8")).k;
      });

      await sut.save("k", "value");

      sub.unsubscribe();
      expect(onDiskAtEmit).toBe("value");
    });
  });

  describe("concurrency", () => {
    beforeEach(async () => {
      sut = makeSut();
      await sut.init();
    });

    it("serializes concurrent writes to different keys without data loss", async () => {
      await Promise.all([sut.save("a", 1), sut.save("b", 2), sut.save("c", 3)]);

      expect(await sut.get("a")).toBe(1);
      expect(await sut.get("b")).toBe(2);
      expect(await sut.get("c")).toBe(3);
    });

    it("converges to one of the writes for concurrent writes to the same key", async () => {
      await Promise.all([sut.save("k", 1), sut.save("k", 2), sut.save("k", 3)]);

      const inMemory = await sut.get("k");
      const onDisk = JSON.parse(fs.readFileSync(dataFilePath, "utf-8")).k;
      expect([1, 2, 3]).toContain(inMemory);
      expect(inMemory).toBe(onDisk);
    });
  });
});
