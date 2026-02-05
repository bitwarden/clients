import { RiskInsightsCompressionService } from "./risk-insights-compression.service";

describe("RiskInsightsCompressionService", () => {
  let service: RiskInsightsCompressionService;

  beforeEach(() => {
    service = new RiskInsightsCompressionService();
  });

  describe("isCompressed", () => {
    it("should return true for compressed data with V2C: marker", () => {
      expect(service.isCompressed("V2C:{...}")).toBe(true);
    });

    it("should return false for uncompressed data", () => {
      expect(service.isCompressed('{"some":"data"}')).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(service.isCompressed("")).toBe(false);
    });

    it("should return false for data with V2C but no colon", () => {
      expect(service.isCompressed("V2Cdata")).toBe(false);
    });
  });
});
