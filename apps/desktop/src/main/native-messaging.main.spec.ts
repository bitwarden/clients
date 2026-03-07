// Unit tests for NativeMessagingMain path validation logic (VULN-425 security fix)
// Tests validate constructor-level ASCII-only enforcement per ADR-068, ADR-070

jest.mock("fs");
jest.mock("os");
jest.mock("path");
jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));
jest.mock("@bitwarden/desktop-napi");

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { NativeMessagingMain } from "./native-messaging.main";
import { WindowMain } from "./window.main";

describe("NativeMessagingMain Path Validation", () => {
  // Mock dependencies for constructor
  const mockLogService = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as LogService;

  const mockWindowMain = {} as WindowMain;

  const validAsciiPaths = {
    appPath: "/Applications/Bitwarden.app/Contents/MacOS",
    exePath: "/Applications/Bitwarden.app/Contents/MacOS/Bitwarden",
    userPath: "/Users/testuser/Library/Application Support/Bitwarden",
  };

  describe("UNIT-VAL-001: Constructor accepts valid ASCII paths", () => {
    it("constructs instance with valid ASCII paths", () => {
      expect(() => {
        new NativeMessagingMain(
          mockLogService,
          mockWindowMain,
          validAsciiPaths.userPath,
          validAsciiPaths.exePath,
          validAsciiPaths.appPath,
        );
      }).not.toThrow();
    });
  });

  describe("UNIT-VAL-002: Constructor rejects Greek Rho in appPath", () => {
    it("throws error when appPath contains Greek Rho (ρ/U+03C1)", () => {
      const invalidPath = "/Applications/Bitwaρden.app/Contents/MacOS"; // Greek Rho substitution

      expect(() => {
        new NativeMessagingMain(
          mockLogService,
          mockWindowMain,
          validAsciiPaths.userPath,
          validAsciiPaths.exePath,
          invalidPath, // appPath with homoglyph
        );
      }).toThrow(/Invalid path for appPath.*ASCII characters/);
    });
  });

  describe("UNIT-VAL-003: Constructor rejects Cyrillic А in exePath", () => {
    it("throws error when exePath contains Cyrillic A (А/U+0410)", () => {
      const invalidPath = "/Applications/Bitwarden.app/Contents/MАcOS/Bitwarden"; // Cyrillic A substitution

      expect(() => {
        new NativeMessagingMain(
          mockLogService,
          mockWindowMain,
          validAsciiPaths.userPath,
          invalidPath, // exePath with homoglyph
          validAsciiPaths.appPath,
        );
      }).toThrow(/Invalid path for exePath.*ASCII characters/);
    });
  });

  describe("UNIT-VAL-004: Constructor rejects Cyrillic С in userPath", () => {
    it("throws error when userPath contains Cyrillic C (С/U+0441)", () => {
      const invalidPath = "/Users/testuser/Library/Appliсation Support/Bitwarden"; // Cyrillic C substitution

      expect(() => {
        new NativeMessagingMain(
          mockLogService,
          mockWindowMain,
          invalidPath, // userPath with homoglyph
          validAsciiPaths.exePath,
          validAsciiPaths.appPath,
        );
      }).toThrow(/Invalid path for userPath.*ASCII characters/);
    });
  });

  describe("UNIT-VAL-005: Constructor rejects empty string paths", () => {
    it("throws error when any path is empty string", () => {
      expect(() => {
        new NativeMessagingMain(
          mockLogService,
          mockWindowMain,
          "", // empty userPath
          validAsciiPaths.exePath,
          validAsciiPaths.appPath,
        );
      }).toThrow(/Invalid path for userPath/);
    });
  });

  describe("UNIT-VAL-006: Constructor rejects control characters", () => {
    it("throws error when path contains newline control character", () => {
      const invalidPath = "/Applications/Bitwarden.app\n/Contents/MacOS"; // newline character

      expect(() => {
        new NativeMessagingMain(
          mockLogService,
          mockWindowMain,
          validAsciiPaths.userPath,
          validAsciiPaths.exePath,
          invalidPath, // appPath with control character
        );
      }).toThrow(/Invalid path for appPath.*ASCII characters/);
    });
  });

  describe("UNIT-VAL-007: Error message clarity validation", () => {
    it("includes pathName and ASCII requirement in error message", () => {
      const invalidPath = "/path/with/homoglyph/ρ";

      try {
        new NativeMessagingMain(
          mockLogService,
          mockWindowMain,
          invalidPath,
          validAsciiPaths.exePath,
          validAsciiPaths.appPath,
        );
        fail("Expected constructor to throw");
      } catch (error) {
        expect(error.message).toContain("userPath"); // pathName identifier
        expect(error.message).toContain("ASCII"); // ASCII requirement explanation
        expect(error.message).toContain("Unicode homoglyphs"); // Security context
      }
    });
  });
});
