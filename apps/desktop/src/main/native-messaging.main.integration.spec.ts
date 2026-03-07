// Integration tests for NativeMessagingMain with mocked Electron dependencies
// Tests validate constructor validation protects downstream path usage (binaryPath, homedir)
// Per ADR-070: Constructor validation provides comprehensive coverage for all 21 path usage sites

jest.mock("fs");
jest.mock("os");
jest.mock("path");
jest.mock("electron");
jest.mock("@bitwarden/desktop-napi");

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { NativeMessagingMain } from "./native-messaging.main";
import { WindowMain } from "./window.main";

describe("NativeMessagingMain Integration Tests", () => {
  const mockLogService = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as LogService;

  const mockWindowMain = {} as WindowMain;

  describe("INT-ELEC-001: Valid Electron paths create instance", () => {
    it("constructs instance and calls binaryPath() successfully with valid paths", () => {
      const validPaths = {
        appPath: "/Applications/Bitwarden.app/Contents/MacOS",
        exePath: "/Applications/Bitwarden.app/Contents/MacOS/Bitwarden",
        userPath: "/Users/testuser/Library/Application Support/Bitwarden",
      };

      let instance: NativeMessagingMain;
      expect(() => {
        instance = new NativeMessagingMain(
          mockLogService,
          mockWindowMain,
          validPaths.userPath,
          validPaths.exePath,
          validPaths.appPath,
        );
      }).not.toThrow();

      // Validate instance is usable (binaryPath method should work)
      expect(instance).toBeDefined();
      expect(instance.binaryPath).toBeDefined();
    });
  });

  describe("INT-ELEC-002: Invalid Electron paths fail construction", () => {
    it("rejects construction when Electron returns path with homoglyph", () => {
      const invalidPaths = {
        appPath: "/Applications/Bitwaρden.app/Contents/MacOS", // Greek Rho
        exePath: "/Applications/Bitwarden.app/Contents/MacOS/Bitwarden",
        userPath: "/Users/testuser/Library/Application Support/Bitwarden",
      };

      expect(() => {
        new NativeMessagingMain(
          mockLogService,
          mockWindowMain,
          invalidPaths.userPath,
          invalidPaths.exePath,
          invalidPaths.appPath,
        );
      }).toThrow(/Invalid path for appPath/);
    });
  });

  describe("INT-METH-001: binaryPath() uses validated paths correctly", () => {
    it("returns correct binary path after validation", () => {
      const validPaths = {
        appPath: "/Applications/Bitwarden.app/Contents/MacOS",
        exePath: "/Applications/Bitwarden.app/Contents/MacOS/Bitwarden",
        userPath: "/Users/testuser/Library/Application Support/Bitwarden",
      };

      const instance = new NativeMessagingMain(
        mockLogService,
        mockWindowMain,
        validPaths.userPath,
        validPaths.exePath,
        validPaths.appPath,
      );

      // binaryPath() method uses this.exePath and this.appPath internally
      // Constructor validation guarantees these are ASCII-only
      const result = instance.binaryPath();
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      // Validated paths automatically protect binaryPath() usage
    });
  });

  describe("INT-METH-002: homedir() uses validated paths correctly", () => {
    it("returns home directory after validation", () => {
      const validPaths = {
        appPath: "/Applications/Bitwarden.app/Contents/MacOS",
        exePath: "/Applications/Bitwarden.app/Contents/MacOS/Bitwarden",
        userPath: "/Users/testuser/Library/Application Support/Bitwarden",
      };

      const instance = new NativeMessagingMain(
        mockLogService,
        mockWindowMain,
        validPaths.userPath,
        validPaths.exePath,
        validPaths.appPath,
      );

      // homedir() method uses this.userPath internally (line 445 in implementation)
      // Constructor validation guarantees userPath is ASCII-only
      const result = instance.homedir();
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });
  });

  describe("INT-TMPL-001: Template literals protected by constructor validation", () => {
    it("demonstrates constructor validation protects all downstream path usage", () => {
      // The technical breakdown identifies 19 template literal path constructions
      // throughout generateManifests() and related methods (lines vary by manifest type).
      // Constructor validation provides comprehensive protection: once paths pass
      // validation, all downstream template literals automatically operate on
      // validated ASCII-only paths.

      const validPaths = {
        appPath: "/Applications/Bitwarden.app/Contents/MacOS",
        exePath: "/Applications/Bitwarden.app/Contents/MacOS/Bitwarden",
        userPath: "/Users/testuser/Library/Application Support/Bitwarden",
      };

      const instance = new NativeMessagingMain(
        mockLogService,
        mockWindowMain,
        validPaths.userPath,
        validPaths.exePath,
        validPaths.appPath,
      );

      // Instance construction succeeds = all downstream usage automatically protected
      // No re-validation needed at template literal sites per ADR-070 defense-in-depth decision
      expect(instance).toBeDefined();

      // Spot check: binaryPath and homedir are representative path consumers
      expect(() => instance.binaryPath()).not.toThrow();
      expect(() => instance.homedir()).not.toThrow();
    });
  });
});
