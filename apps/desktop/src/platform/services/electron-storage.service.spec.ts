import * as fs from "fs";

import { ipcMain } from "electron";
import ElectronStore from "electron-store";
import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";
import { NodeUtils } from "@bitwarden/node/node-utils";

import { ElectronStorageService } from "./electron-storage.service";

// Mock electron and electron-store
jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
}));

jest.mock("fs");
jest.mock("@bitwarden/node/node-utils");
jest.mock("../../utils", () => ({
  isWindowsPortable: jest.fn(() => false),
}));

// Create a shared mock store instance
const createMockStore = () => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  has: jest.fn(),
});

const mockStoreInstance = createMockStore();

jest.mock("electron-store", () => {
  const MockConstructor = jest.fn().mockImplementation(() => mockStoreInstance);
  return {
    __esModule: true,
    default: MockConstructor,
  };
});

// Get reference to the mocked constructor after the mock is set up
const mockStoreConstructor = ElectronStore as unknown as jest.Mock;

describe("ElectronStorageService", () => {
  let service: ElectronStorageService;
  let logService: MockProxy<LogService>;
  const testDir = "/test/dir";

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mock store instance to clear all previous implementations
    mockStoreInstance.get.mockReset();
    mockStoreInstance.set.mockReset();
    mockStoreInstance.delete.mockReset();
    mockStoreInstance.has.mockReset();

    // Reset the constructor mock to return the store instance successfully
    mockStoreConstructor.mockClear();
    mockStoreConstructor.mockImplementation(() => mockStoreInstance);

    logService = mock<LogService>();
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    service = new ElectronStorageService(logService, testDir);
  });

  describe("constructor", () => {
    it("should create the directory if it does not exist", () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      NodeUtils.mkdirpSync = jest.fn();

      new ElectronStorageService(logService, testDir);

      expect(NodeUtils.mkdirpSync).toHaveBeenCalledWith(testDir, "700");
    });

    it("should initialize the updates$ observable", () => {
      expect(service.updates$).toBeDefined();
      expect(service.updates$).toBeInstanceOf(Object);
    });

    it("should register IPC handler", () => {
      expect(ipcMain.handle).toHaveBeenCalledWith("storageService", expect.any(Function));
    });
  });

  describe("Constructor Error Recovery", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockStoreConstructor.mockClear();

      // Reset fs methods to their default mocks
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.renameSync as jest.Mock) = jest.fn();
      (fs.unlinkSync as jest.Mock) = jest.fn();

      logService = mock<LogService>();
    });

    it("should initialize successfully when ElectronStore does not throw", () => {
      mockStoreConstructor.mockImplementation(() => mockStoreInstance);
      expect(() => new ElectronStorageService(logService, testDir)).not.toThrow();
      expect(logService.error).not.toHaveBeenCalled();
    });

    it("should backup corrupted file and retry when initialization fails", () => {
      // Mock the constructor to throw once, then succeed
      mockStoreConstructor
        .mockImplementationOnce(() => {
          throw new SyntaxError("Unexpected token in JSON at position 22");
        })
        .mockImplementationOnce(() => mockStoreInstance);

      const dataFilePath = `${testDir}/data.json`;
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === testDir || path === dataFilePath;
      });

      const testService = new ElectronStorageService(logService, testDir);

      expect(testService).toBeDefined();
      expect(logService.error).toHaveBeenCalledWith(
        "ElectronStore initialization failed, attempting recovery",
        expect.any(SyntaxError),
      );
      expect(fs.renameSync).toHaveBeenCalledWith(
        dataFilePath,
        expect.stringMatching(/data\.json\.corrupt\.\d+/),
      );
      expect(logService.warning).toHaveBeenCalledWith(
        expect.stringMatching(/Backed up corrupted data file to/),
      );
      expect(logService.info).toHaveBeenCalledWith("ElectronStore recovered successfully");
      expect(mockStoreConstructor).toHaveBeenCalledTimes(2);
    });

    it("should delete file if backup fails", () => {
      mockStoreConstructor
        .mockImplementationOnce(() => {
          throw new SyntaxError("Unexpected token in JSON");
        })
        .mockImplementationOnce(() => mockStoreInstance);

      const dataFilePath = `${testDir}/data.json`;
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === testDir || path === dataFilePath;
      });
      (fs.renameSync as jest.Mock).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const testService = new ElectronStorageService(logService, testDir);

      expect(testService).toBeDefined();
      expect(logService.error).toHaveBeenCalledWith(
        "Failed to backup corrupted file",
        expect.any(Error),
      );
      expect(fs.unlinkSync).toHaveBeenCalledWith(dataFilePath);
      expect(logService.warning).toHaveBeenCalledWith("Deleted corrupted data file");
      expect(logService.info).toHaveBeenCalledWith("ElectronStore recovered successfully");
    });

    it("should log error if both backup and delete fail", () => {
      mockStoreConstructor
        .mockImplementationOnce(() => {
          throw new SyntaxError("Unexpected token in JSON");
        })
        .mockImplementationOnce(() => mockStoreInstance);

      const dataFilePath = `${testDir}/data.json`;
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === testDir || path === dataFilePath;
      });
      (fs.renameSync as jest.Mock).mockImplementation(() => {
        throw new Error("Permission denied");
      });
      (fs.unlinkSync as jest.Mock).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const testService = new ElectronStorageService(logService, testDir);

      expect(testService).toBeDefined();
      expect(logService.error).toHaveBeenCalledWith(
        "Failed to backup corrupted file",
        expect.any(Error),
      );
      expect(logService.error).toHaveBeenCalledWith(
        "Failed to delete corrupted file",
        expect.any(Error),
      );
      // Should still recover if retry succeeds
      expect(logService.info).toHaveBeenCalledWith("ElectronStore recovered successfully");
    });

    it("should not attempt file operations if data file does not exist", () => {
      mockStoreConstructor
        .mockImplementationOnce(() => {
          throw new SyntaxError("Unexpected token in JSON");
        })
        .mockImplementationOnce(() => mockStoreInstance);

      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === testDir; // Only dir exists, not the data file
      });

      const testService = new ElectronStorageService(logService, testDir);

      expect(testService).toBeDefined();
      expect(fs.renameSync).not.toHaveBeenCalled();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(logService.info).toHaveBeenCalledWith("ElectronStore recovered successfully");
    });

    it("should throw error if recovery fails", () => {
      const recoveryError = new Error("Failed to create store after cleanup");
      mockStoreConstructor.mockImplementation(() => {
        throw recoveryError;
      });

      const dataFilePath = `${testDir}/data.json`;
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === testDir || path === dataFilePath;
      });

      expect(() => new ElectronStorageService(logService, testDir)).toThrow(recoveryError);
      expect(logService.error).toHaveBeenCalledWith(
        "Failed to recover ElectronStore",
        recoveryError,
      );
    });

    it("should use timestamp in backup filename", () => {
      const mockTimestamp = 1234567890123;
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => mockTimestamp);

      mockStoreConstructor
        .mockImplementationOnce(() => {
          throw new SyntaxError("Unexpected token in JSON");
        })
        .mockImplementationOnce(() => mockStoreInstance);

      const dataFilePath = `${testDir}/data.json`;
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === testDir || path === dataFilePath;
      });

      new ElectronStorageService(logService, testDir);

      expect(fs.renameSync).toHaveBeenCalledWith(
        dataFilePath,
        `${testDir}/data.json.corrupt.${mockTimestamp}`,
      );

      Date.now = originalDateNow;
    });
  });

  describe("valuesRequireDeserialization", () => {
    it("should return true", () => {
      expect(service.valuesRequireDeserialization).toBe(true);
    });
  });

  describe("get", () => {
    it("should retrieve a value successfully", async () => {
      const testKey = "testKey";
      const testValue = { data: "test" };
      mockStoreInstance.get.mockReturnValue(testValue);

      const result = await service.get(testKey);

      expect(result).toEqual(testValue);
      expect(mockStoreInstance.get).toHaveBeenCalledWith(testKey);
    });

    it("should return null if value does not exist", async () => {
      const testKey = "nonExistentKey";
      mockStoreInstance.get.mockReturnValue(null);

      const result = await service.get(testKey);

      expect(result).toBeNull();
    });

    it("should return null if value is undefined", async () => {
      const testKey = "undefinedKey";
      mockStoreInstance.get.mockReturnValue(undefined);

      const result = await service.get(testKey);

      expect(result).toBeNull();
    });

    it("should handle deserialization errors and return null", async () => {
      const testKey = "corruptedKey";
      const error = new Error("Deserialization failed");
      mockStoreInstance.get.mockImplementation(() => {
        throw error;
      });

      const result = await service.get(testKey);

      expect(result).toBeNull();
      expect(logService.error).toHaveBeenCalledWith(
        "Error retrieving value from ElectronStore",
        testKey,
        error,
      );
    });

    it("should attempt to delete corrupted key after deserialization error", async () => {
      const testKey = "corruptedKey";
      mockStoreInstance.get.mockImplementation(() => {
        throw new Error("Deserialization failed");
      });

      await service.get(testKey);

      expect(mockStoreInstance.delete).toHaveBeenCalledWith(testKey);
    });

    it("should handle errors during corrupted key cleanup silently", async () => {
      const testKey = "corruptedKey";
      mockStoreInstance.get.mockImplementation(() => {
        throw new Error("Deserialization failed");
      });
      mockStoreInstance.delete.mockImplementation(() => {
        throw new Error("Delete failed");
      });

      const result = await service.get(testKey);

      expect(result).toBeNull();
      expect(logService.error).toHaveBeenCalledTimes(1); // Only the get error, not the delete error
    });
  });

  describe("has", () => {
    it("should return true if key exists", async () => {
      const testKey = "existingKey";
      mockStoreInstance.get.mockReturnValue({ data: "test" });

      const result = await service.has(testKey);

      expect(result).toBe(true);
      expect(mockStoreInstance.get).toHaveBeenCalledWith(testKey);
    });

    it("should return false if key does not exist", async () => {
      const testKey = "nonExistentKey";
      mockStoreInstance.get.mockReturnValue(null);

      const result = await service.has(testKey);

      expect(result).toBe(false);
    });

    it("should return false if value is undefined", async () => {
      const testKey = "undefinedKey";
      mockStoreInstance.get.mockReturnValue(undefined);

      const result = await service.has(testKey);

      expect(result).toBe(false);
    });

    it("should handle deserialization errors and return false", async () => {
      const testKey = "corruptedKey";
      const error = new Error("Deserialization failed");
      mockStoreInstance.get.mockImplementation(() => {
        throw error;
      });

      const result = await service.has(testKey);

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "Error checking for key existence in ElectronStore",
        testKey,
        error,
      );
    });
  });

  describe("save", () => {
    it("should save a value successfully", async () => {
      const testKey = "testKey";
      const testValue = { data: "test" };
      const updates: any[] = [];

      service.updates$.subscribe((update) => updates.push(update));

      await service.save(testKey, testValue);

      expect(mockStoreInstance.set).toHaveBeenCalledWith(testKey, testValue);
      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual({ key: testKey, updateType: "save" });
    });

    it("should remove key if value is undefined", async () => {
      const testKey = "testKey";
      const updates: any[] = [];

      service.updates$.subscribe((update) => updates.push(update));

      await service.save(testKey, undefined);

      expect(mockStoreInstance.delete).toHaveBeenCalledWith(testKey);
      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual({ key: testKey, updateType: "remove" });
    });

    it("should convert Set to Array before saving", async () => {
      const testKey = "testKey";
      const testSet = new Set([1, 2, 3]);

      await service.save(testKey, testSet);

      expect(mockStoreInstance.set).toHaveBeenCalledWith(testKey, [1, 2, 3]);
    });

    it("should handle save errors and reject promise", async () => {
      const testKey = "testKey";
      const testValue = { data: "test" };
      const error = new Error("Save failed");
      mockStoreInstance.set.mockImplementation(() => {
        throw error;
      });

      await expect(service.save(testKey, testValue)).rejects.toThrow(error);
      expect(logService.error).toHaveBeenCalledWith(
        "Error saving value to ElectronStore",
        testKey,
        error,
      );
    });

    it("should not emit update event if save fails", async () => {
      const testKey = "testKey";
      const testValue = { data: "test" };
      const updates: any[] = [];
      mockStoreInstance.set.mockImplementation(() => {
        throw new Error("Save failed");
      });

      service.updates$.subscribe((update) => updates.push(update));

      await expect(service.save(testKey, testValue)).rejects.toThrow();
      expect(updates).toHaveLength(0);
    });

    it("should save null values", async () => {
      const testKey = "testKey";
      const testValue = null;

      await service.save(testKey, testValue);

      expect(mockStoreInstance.set).toHaveBeenCalledWith(testKey, null);
    });

    it("should save various data types", async () => {
      const testCases = [
        { key: "string", value: "test string" },
        { key: "number", value: 42 },
        { key: "boolean", value: true },
        { key: "array", value: [1, 2, 3] },
        { key: "object", value: { nested: { data: "test" } } },
        { key: "null", value: null },
      ];

      for (const testCase of testCases) {
        await service.save(testCase.key, testCase.value);
        expect(mockStoreInstance.set).toHaveBeenCalledWith(testCase.key, testCase.value);
      }
    });
  });

  describe("remove", () => {
    it("should remove a key successfully", async () => {
      const testKey = "testKey";
      const updates: any[] = [];

      service.updates$.subscribe((update) => updates.push(update));

      await service.remove(testKey);

      expect(mockStoreInstance.delete).toHaveBeenCalledWith(testKey);
      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual({ key: testKey, updateType: "remove" });
    });

    it("should handle remove errors and reject promise", async () => {
      const testKey = "testKey";
      const error = new Error("Remove failed");
      mockStoreInstance.delete.mockImplementation(() => {
        throw error;
      });

      await expect(service.remove(testKey)).rejects.toThrow(error);
      expect(logService.error).toHaveBeenCalledWith(
        "Error removing from ElectronStore",
        testKey,
        error,
      );
    });

    it("should not emit update event if remove fails", async () => {
      const testKey = "testKey";
      const updates: any[] = [];
      mockStoreInstance.delete.mockImplementation(() => {
        throw new Error("Remove failed");
      });

      service.updates$.subscribe((update) => updates.push(update));

      await expect(service.remove(testKey)).rejects.toThrow();
      expect(updates).toHaveLength(0);
    });
  });

  describe("IPC handler", () => {
    let ipcHandler: any;

    beforeEach(() => {
      ipcHandler = (ipcMain.handle as jest.Mock).mock.calls[0][1];
    });

    it("should handle get action", async () => {
      const testKey = "testKey";
      const testValue = { data: "test" };
      mockStoreInstance.get.mockReturnValue(testValue);

      const result = await ipcHandler(null, { action: "get", key: testKey });

      expect(result).toEqual(testValue);
    });

    it("should handle has action", async () => {
      const testKey = "testKey";
      mockStoreInstance.get.mockReturnValue({ data: "test" });

      const result = await ipcHandler(null, { action: "has", key: testKey });

      expect(result).toBe(true);
    });

    it("should handle save action", async () => {
      const testKey = "testKey";
      const testValue = { data: "test" };

      await ipcHandler(null, { action: "save", key: testKey, obj: testValue });

      expect(mockStoreInstance.set).toHaveBeenCalledWith(testKey, testValue);
    });

    it("should handle remove action", async () => {
      const testKey = "testKey";

      await ipcHandler(null, { action: "remove", key: testKey });

      expect(mockStoreInstance.delete).toHaveBeenCalledWith(testKey);
    });
  });
});
