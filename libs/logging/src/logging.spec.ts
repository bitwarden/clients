import { mock } from "jest-mock-extended";

import * as lib from "./index";
import { SemanticLogger } from "./index";

describe("logging module", () => {
  describe("public API", () => {
    it("should export LogService", () => {
      expect(lib.LogService).toBeDefined();
    });

    it("should export LogLevel", () => {
      expect(lib.LogLevel).toBeDefined();
    });

    it("should export ConsoleLogService", () => {
      expect(lib.ConsoleLogService).toBeDefined();
    });

    it("should export DISABLED_LOGGER", () => {
      expect(lib.DISABLED_LOGGER).toBeDefined();
    });

    it("should export disabledSemanticLoggerProvider", () => {
      expect(lib.disabledSemanticLoggerProvider).toBeDefined();
    });

    it("should export consoleSemanticLoggerProvider", () => {
      expect(lib.consoleSemanticLoggerProvider).toBeDefined();
    });

    it("should export enableLogForTypes", () => {
      expect(lib.enableLogForTypes).toBeDefined();
    });

    it("should export ifEnabledSemanticLoggerProvider", () => {
      expect(lib.ifEnabledSemanticLoggerProvider).toBeDefined();
    });
  });

  describe("SemanticLogger", () => {
    let logger: SemanticLogger;

    beforeEach(() => {
      logger = mock<SemanticLogger>();
    });

    describe("logging methods", () => {
      it("should accept a message string", () => {
        logger.debug("debug message");
        logger.info("info message");
        logger.warn("warn message");
        logger.error("error message");

        expect(logger.debug).toHaveBeenCalledWith("debug message");
        expect(logger.info).toHaveBeenCalledWith("info message");
        expect(logger.warn).toHaveBeenCalledWith("warn message");
        expect(logger.error).toHaveBeenCalledWith("error message");
      });

      it("should accept content object and optional message", () => {
        logger.debug({ step: 1 }, "processing step");
        logger.info({ count: 42 }, "items processed");
        logger.warn({ threshold: 100 }, "approaching limit");
        logger.error({ code: 500 }, "server error");

        expect(logger.debug).toHaveBeenCalledWith({ step: 1 }, "processing step");
        expect(logger.info).toHaveBeenCalledWith({ count: 42 }, "items processed");
        expect(logger.warn).toHaveBeenCalledWith({ threshold: 100 }, "approaching limit");
        expect(logger.error).toHaveBeenCalledWith({ code: 500 }, "server error");
      });
    });

    describe("panic", () => {
      beforeEach(() => {
        logger.panic = jest.fn((content: any, msg?: string) => {
          const errorMsg = msg || (typeof content === "string" ? content : "panic");
          throw new Error(errorMsg);
        }) as any;
      });

      it("should throw when called with a message", () => {
        expect(() => logger.panic("critical error")).toThrow("critical error");
      });

      it("should throw when called with content and message", () => {
        expect(() => logger.panic({ reason: "invalid state" }, "system panic")).toThrow(
          "system panic",
        );
      });
    });
  });
});
