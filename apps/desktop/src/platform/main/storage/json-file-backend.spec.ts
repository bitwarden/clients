import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { JsonFileBackend } from "./json-file-backend";

describe("JsonFileBackend", () => {
  let dir: string;
  let filePath: string;
  let corruptPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-file-backend-"));
    filePath = path.join(dir, "data.json");
    corruptPath = path.join(dir, "data.json.corrupt");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe("read", () => {
    it("should return an empty store when the file doesn't exist", () => {
      const sut = new JsonFileBackend(dir);

      expect(sut.read()).toEqual({});
      expect(sut.corruptFileSize).toBeNull();
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
      ["null", "null"],
      ["an array", "[]"],
      ["NUL bytes", "\0\0\0\0"],
    ])("should move a file that is %s aside and start empty", (_, contents) => {
      fs.writeFileSync(filePath, contents);
      const sut = new JsonFileBackend(dir);

      expect(sut.read()).toEqual({});
      expect(sut.corruptFileSize).toBe(Buffer.byteLength(contents));
      expect(fs.existsSync(filePath)).toBe(false);
      expect(fs.readFileSync(corruptPath, "utf8")).toBe(contents);
    });

    it("should replace an earlier corrupt file", () => {
      fs.writeFileSync(corruptPath, "older");
      fs.writeFileSync(filePath, "newer");

      new JsonFileBackend(dir).read();

      expect(fs.readdirSync(dir)).toEqual(["data.json.corrupt"]);
      expect(fs.readFileSync(corruptPath, "utf8")).toBe("newer");
    });

    it("should delete a corrupt copy older than 30 days", () => {
      fs.writeFileSync(corruptPath, "old");
      const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      fs.utimesSync(corruptPath, old, old);

      new JsonFileBackend(dir);

      expect(fs.existsSync(corruptPath)).toBe(false);
    });

    it("should keep a corrupt copy newer than 30 days", () => {
      fs.writeFileSync(corruptPath, "recent");

      new JsonFileBackend(dir);

      expect(fs.existsSync(corruptPath)).toBe(true);
    });

    it("should count the 30 days from the recovery, not from the file's last write", () => {
      fs.writeFileSync(filePath, '{"key": "val');
      const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      fs.utimesSync(filePath, old, old);
      new JsonFileBackend(dir).read();

      new JsonFileBackend(dir);

      expect(fs.existsSync(corruptPath)).toBe(true);
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
