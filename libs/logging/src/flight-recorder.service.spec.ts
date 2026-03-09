import { FlightRecorderLogData, FlightRecorderService } from "./flight-recorder.service";

// Mock the SDK module
const mockDrain = jest.fn();
const mockCount = jest.fn();

jest.mock("@bitwarden/sdk-internal", () => ({
  FlightRecorderClient: jest.fn().mockImplementation(() => ({
    drain: mockDrain,
    count: mockCount,
  })),
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: {
    Ready: Promise.resolve(),
  },
}));

describe("FlightRecorderService", () => {
  let service: FlightRecorderService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDrain.mockReturnValue([]);
    mockCount.mockReturnValue(0);
    service = new FlightRecorderService();
  });

  describe("read", () => {
    it("returns events from SDK client", async () => {
      const mockEvents: FlightRecorderLogData[] = [
        {
          timestamp: 1234567890,
          level: "INFO",
          target: "test::module",
          message: "Test message",
          fields: {},
        },
      ];
      mockDrain.mockReturnValue(mockEvents);

      const result = await service.read();

      expect(result).toEqual(mockEvents);
      expect(mockDrain).toHaveBeenCalled();
    });

    it("returns empty array when no events", async () => {
      mockDrain.mockReturnValue([]);

      const result = await service.read();

      expect(result).toEqual([]);
    });
  });

  describe("count", () => {
    it("returns count from SDK client", async () => {
      mockCount.mockReturnValue(42);

      const result = await service.count();

      expect(result).toEqual(42);
      expect(mockCount).toHaveBeenCalled();
    });
  });

  describe("exportAsJson", () => {
    it("formats events as JSON with 2-space indentation", async () => {
      const mockEvents: FlightRecorderLogData[] = [
        {
          timestamp: 1234567890,
          level: "INFO",
          target: "test",
          message: "Test",
          fields: { key: "value" },
        },
      ];
      mockDrain.mockReturnValue(mockEvents);

      const result = await service.exportAsJson();

      expect(() => JSON.parse(result)).not.toThrow();
      expect(result).toContain("  "); // 2-space indentation
    });

    it("returns empty array JSON when no events", async () => {
      mockDrain.mockReturnValue([]);

      const result = await service.exportAsJson();

      expect(result).toEqual("[]");
    });
  });

  describe("exportAsPlainText", () => {
    it("formats events as plain text lines", async () => {
      const mockEvents: FlightRecorderLogData[] = [
        {
          timestamp: 1704067200000, // 2024-01-01T00:00:00.000Z
          level: "info",
          target: "test::module",
          message: "Test message",
          fields: {},
        },
      ];
      mockDrain.mockReturnValue(mockEvents);

      const result = await service.exportAsPlainText();

      expect(result).toContain("INFO");
      expect(result).toContain("test::module");
      expect(result).toContain("Test message");
    });

    it("includes fields in plain text output", async () => {
      const mockEvents: FlightRecorderLogData[] = [
        {
          timestamp: 1704067200000,
          level: "info",
          target: "test",
          message: "Test",
          fields: { user_id: "123", action: "login" },
        },
      ];
      mockDrain.mockReturnValue(mockEvents);

      const result = await service.exportAsPlainText();

      expect(result).toContain("[user_id=123");
      expect(result).toContain("action=login");
    });

    it("returns empty string when no events", async () => {
      mockDrain.mockReturnValue([]);

      const result = await service.exportAsPlainText();

      expect(result).toBe("");
    });
  });
});
