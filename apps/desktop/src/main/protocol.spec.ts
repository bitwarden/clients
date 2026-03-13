import * as path from "path";

import { resolveProtocolPath } from "./protocol";

const baseDir = "/app/dist";
const host = "bundle";
const scheme = "bw-desktop-file";

function resolve(pathname: string): string | null {
  return resolveProtocolPath(`${scheme}://${host}${pathname}`, host, baseDir);
}

describe("resolveProtocolPath", () => {
  describe("valid requests", () => {
    it("resolves a simple file path", () => {
      expect(resolve("/index.html")).toBe(path.join(baseDir, "index.html"));
    });

    it("resolves a nested file path", () => {
      expect(resolve("/assets/styles.css")).toBe(path.join(baseDir, "assets", "styles.css"));
    });

    it("defaults to index.html when pathname is empty", () => {
      expect(resolve("/")).toBe(path.join(baseDir, "index.html"));
      expect(resolve("")).toBe(path.join(baseDir, "index.html"));
    });
  });

  describe("directory traversal prevention", () => {
    // Note: new URL() normalizes ".." and "." segments during parsing, so "/../etc/passwd"
    // becomes "/etc/passwd" before our code sees it. These tests verify that
    // URL-normalized traversal attempts resolve safely within baseDir.

    it("../ traversal stays inside base dir", () => {
      expect(resolve("/../../../etc/passwd")).toBe(path.join(baseDir, "etc", "passwd"));
    });

    it("nested ../ traversal stays inside base dir", () => {
      expect(resolve("/assets/../../etc/passwd")).toBe(path.join(baseDir, "etc", "passwd"));
    });

    it("encoded ../ traversal stays inside base dir", () => {
      expect(resolve("/%2e%2e/etc/passwd")).toBe(path.join(baseDir, "etc", "passwd"));
    });

    it("double-encoded traversal stays as literal %2e inside base dir", () => {
      expect(resolve("/%252e%252e/etc/passwd")).toBe(
        path.join(baseDir, "%252e%252e", "etc", "passwd"),
      );
    });
  });

  describe("absolute path prevention", () => {
    it("rejects absolute unix paths", () => {
      expect(resolve("//etc/passwd")).toBeNull();
    });

    it("rejects root path", () => {
      expect(resolve("//")).toBeNull();
    });
  });

  describe("URL component stripping", () => {
    it("ignores query strings", () => {
      expect(resolve("/index.html?foo=bar")).toBe(path.join(baseDir, "index.html"));
    });

    it("ignores fragments", () => {
      expect(resolve("/index.html#section")).toBe(path.join(baseDir, "index.html"));
    });

    it("normalizes /. to root via URL parsing", () => {
      expect(resolve("/.")).toBe(path.join(baseDir, "index.html"));
    });
  });

  describe("invalid hosts", () => {
    it("rejects requests with wrong host", () => {
      expect(resolveProtocolPath(`${scheme}://evil-host/index.html`, host, baseDir)).toBeNull();
    });

    it("rejects requests with empty host", () => {
      expect(resolveProtocolPath(`${scheme}:///index.html`, host, baseDir)).toBeNull();
    });
  });
});
