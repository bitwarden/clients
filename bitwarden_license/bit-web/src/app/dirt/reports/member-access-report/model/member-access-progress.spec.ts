import {
  MemberAccessProgress,
  MemberAccessProgressConfig,
  MemberAccessProgressState,
  calculateProgressPercentage,
} from "./member-access-progress";

describe("MemberAccessProgress", () => {
  describe("Progress Configuration", () => {
    it("should have valid configuration for all progress steps", () => {
      // Verify all steps have a config entry
      Object.values(MemberAccessProgress).forEach((step) => {
        const config = MemberAccessProgressConfig[step];
        expect(config).toBeDefined();
        expect(config.messageKey).toBeDefined();
        expect(config.progress).toBeDefined();
        expect(typeof config.messageKey).toBe("string");
        expect(typeof config.progress).toBe("number");
      });
    });

    it("should have 'reportGenerationComplete' as the completion message key", () => {
      const completeConfig = MemberAccessProgressConfig[MemberAccessProgress.Complete];
      expect(completeConfig.messageKey).toBe("reportGenerationComplete");
    });

    it("should have 100% progress for Complete step", () => {
      const completeConfig = MemberAccessProgressConfig[MemberAccessProgress.Complete];
      expect(completeConfig.progress).toBe(100);
    });

    it("should have sequential progress values", () => {
      const progressValues = [
        MemberAccessProgressConfig[MemberAccessProgress.FetchingMembers].progress,
        MemberAccessProgressConfig[MemberAccessProgress.FetchingCollections].progress,
        MemberAccessProgressConfig[MemberAccessProgress.FetchingGroups].progress,
        MemberAccessProgressConfig[MemberAccessProgress.FetchingCipherCounts].progress,
        MemberAccessProgressConfig[MemberAccessProgress.BuildingMaps].progress,
        MemberAccessProgressConfig[MemberAccessProgress.ProcessingMembers].progress,
        MemberAccessProgressConfig[MemberAccessProgress.Complete].progress,
      ];

      // Verify values are in ascending order
      for (let i = 0; i < progressValues.length - 1; i++) {
        expect(progressValues[i]).toBeLessThanOrEqual(progressValues[i + 1]);
      }
    });

    it("should have unique message keys for all steps", () => {
      const messageKeys = Object.values(MemberAccessProgressConfig).map((c) => c.messageKey);
      const uniqueKeys = new Set(messageKeys);
      expect(uniqueKeys.size).toBe(messageKeys.length);
    });
  });

  describe("calculateProgressPercentage", () => {
    it("should return static progress for non-ProcessingMembers steps", () => {
      const state: MemberAccessProgressState = {
        step: MemberAccessProgress.FetchingMembers,
        processedMembers: 0,
        totalMembers: 100,
        message: "",
      };

      const result = calculateProgressPercentage(state);
      expect(result).toBe(
        MemberAccessProgressConfig[MemberAccessProgress.FetchingMembers].progress,
      );
    });

    it("should calculate dynamic progress for ProcessingMembers step", () => {
      const state: MemberAccessProgressState = {
        step: MemberAccessProgress.ProcessingMembers,
        processedMembers: 50,
        totalMembers: 100,
        message: "",
      };

      const result = calculateProgressPercentage(state);
      // 35% base + (50/100 * 60%) = 35% + 30% = 65%
      expect(result).toBe(65);
    });

    it("should return 35% for ProcessingMembers with 0 processed", () => {
      const state: MemberAccessProgressState = {
        step: MemberAccessProgress.ProcessingMembers,
        processedMembers: 0,
        totalMembers: 100,
        message: "",
      };

      const result = calculateProgressPercentage(state);
      expect(result).toBe(35);
    });

    it("should cap at 95% for ProcessingMembers with all processed", () => {
      const state: MemberAccessProgressState = {
        step: MemberAccessProgress.ProcessingMembers,
        processedMembers: 100,
        totalMembers: 100,
        message: "",
      };

      const result = calculateProgressPercentage(state);
      // 35% + (100/100 * 60%) = 35% + 60% = 95%
      expect(result).toBe(95);
    });

    it("should handle ProcessingMembers with 0 total members", () => {
      const state: MemberAccessProgressState = {
        step: MemberAccessProgress.ProcessingMembers,
        processedMembers: 0,
        totalMembers: 0,
        message: "",
      };

      const result = calculateProgressPercentage(state);
      // Should use static progress when totalMembers is 0
      expect(result).toBe(
        MemberAccessProgressConfig[MemberAccessProgress.ProcessingMembers].progress,
      );
    });

    it("should return 100% for Complete step", () => {
      const state: MemberAccessProgressState = {
        step: MemberAccessProgress.Complete,
        processedMembers: 100,
        totalMembers: 100,
        message: "",
      };

      const result = calculateProgressPercentage(state);
      expect(result).toBe(100);
    });

    it("should calculate correct progress for partial processing", () => {
      const testCases = [
        { processed: 10, total: 100, expected: 41 }, // 35 + (10/100 * 60)
        { processed: 25, total: 100, expected: 50 }, // 35 + (25/100 * 60)
        { processed: 75, total: 100, expected: 80 }, // 35 + (75/100 * 60)
      ];

      testCases.forEach(({ processed, total, expected }) => {
        const state: MemberAccessProgressState = {
          step: MemberAccessProgress.ProcessingMembers,
          processedMembers: processed,
          totalMembers: total,
          message: "",
        };

        const result = calculateProgressPercentage(state);
        expect(result).toBe(expected);
      });
    });
  });
});
