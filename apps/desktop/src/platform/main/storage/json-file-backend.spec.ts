import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { JsonFileBackend } from "./json-file-backend";

describe("JsonFileBackend", () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-file-backend-"));
    filePath = path.join(dir, "data.json");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe("read", () => {
    it("should return an empty store when the file doesn't exist", () => {
      const sut = new JsonFileBackend(dir);

      expect(sut.read()).toEqual({});
      expect(sut.startupErrors).toEqual([]);
    });

    it("should return the stored object", () => {
      fs.writeFileSync(filePath, JSON.stringify({ key: "value" }));

      expect(new JsonFileBackend(dir).read()).toEqual({ key: "value" });
    });

    it("should create the directory when it doesn't exist", () => {
      const nested = path.join(dir, "nested");

      new JsonFileBackend(nested).update(() => ({ key: "value" }));

      expect(JSON.parse(fs.readFileSync(path.join(nested, "data.json"), "utf8"))).toEqual({
        key: "value",
      });
    });

    it.each([
      ["empty", ""],
      ["truncated", '{"key": "val'],
      ["broken mid-file", '{"key": "v" x}'],
      ["an unexpected token", '{"key": x}'],
      ["null", "null"],
      ["an array", "[]"],
      ["a string", '"text"'],
      ["NUL characters", "\0\0\0\0"],
      ["whitespace", " \n"],
    ])("should delete a file that is %s, start empty and report it", (_, contents) => {
      fs.writeFileSync(filePath, contents);
      const sut = new JsonFileBackend(dir);

      expect(sut.read()).toEqual({});
      expect(sut.startupErrors).not.toEqual([]);
      expect(fs.readdirSync(dir)).toEqual([]);
    });

    it.each([
      ["an unexpected token", '{"key": secret}'],
      ["a truncated value", '{"key": "secret'],
    ])("should not quote the file contents when it has %s", (_, contents) => {
      fs.writeFileSync(filePath, contents);
      const sut = new JsonFileBackend(dir);

      sut.read();

      expect(sut.startupErrors.join("\n")).not.toContain("secret");
    });

    it("should start empty and report it when reading the write time and deleting fail", () => {
      fs.writeFileSync(filePath, "null");
      const sut = new JsonFileBackend(dir);
      jest.spyOn(fs, "statSync").mockImplementationOnce(() => {
        throw new Error("ENOENT: no such file or directory, stat");
      });
      jest.spyOn(fs, "rmSync").mockImplementationOnce(() => {
        throw new Error("EPERM: operation not permitted, unlink");
      });

      expect(sut.read()).toEqual({});
      expect(sut.startupErrors).not.toEqual([]);
    });
  });

  describe("temporary file cleanup", () => {
    it("should remove temporary files older than a minute", () => {
      const stale = path.join(dir, "data.json.tmp-123-aaaa");
      fs.writeFileSync(stale, "partial");
      const old = new Date(Date.now() - 120_000);
      fs.utimesSync(stale, old, old);

      new JsonFileBackend(dir);

      expect(fs.existsSync(stale)).toBe(false);
    });

    it("should keep recent temporary files, which another process may still be writing", () => {
      const recent = path.join(dir, "data.json.tmp-123-bbbb");
      fs.writeFileSync(recent, "partial");

      new JsonFileBackend(dir);

      expect(fs.existsSync(recent)).toBe(true);
    });
  });

  describe("update", () => {
    it("should write the store to the file", () => {
      const sut = new JsonFileBackend(dir);

      sut.update((store) => ({ ...store, key: "value" }));

      expect(JSON.parse(fs.readFileSync(filePath, "utf8"))).toEqual({ key: "value" });
      expect(new JsonFileBackend(dir).read()).toEqual({ key: "value" });
    });

    it("should pass the current store to the updater", () => {
      fs.writeFileSync(filePath, JSON.stringify({ a: 1 }));
      const sut = new JsonFileBackend(dir);

      sut.update((store) => ({ ...store, b: 2 }));

      expect(sut.read()).toEqual({ a: 1, b: 2 });
    });

    it("should keep the previous file and remove the temporary file when the rename fails", () => {
      fs.writeFileSync(filePath, JSON.stringify({ key: "old" }));
      const sut = new JsonFileBackend(dir);
      const error = new Error("EBUSY: resource busy or locked, rename");
      jest.spyOn(fs, "renameSync").mockImplementationOnce(() => {
        throw error;
      });

      expect(() => sut.update(() => ({ key: "new" }))).toThrow(error);

      expect(JSON.parse(fs.readFileSync(filePath, "utf8"))).toEqual({ key: "old" });
      expect(fs.readdirSync(dir)).toEqual(["data.json"]);
      expect(sut.read()).toEqual({ key: "old" });
    });

    it("should write each update through its own temporary file", () => {
      const openSync = jest.spyOn(fs, "openSync");
      const sut = new JsonFileBackend(dir);

      sut.update(() => ({ key: "first" }));
      sut.update(() => ({ key: "second" }));

      const tempPaths = openSync.mock.calls
        .map(([file]) => String(file))
        .filter((file) => file.includes("data.json.tmp-"));
      expect(tempPaths).toHaveLength(2);
      expect(new Set(tempPaths).size).toBe(2);
      expect(fs.readdirSync(dir)).toEqual(["data.json"]);
    });

    if (process.platform !== "win32") {
      it("should create the file readable only by its owner", () => {
        new JsonFileBackend(dir).update(() => ({ key: "value" }));

        expect(fs.statSync(filePath).mode & 0o777).toBe(0o600);
      });
    }
  });
});
