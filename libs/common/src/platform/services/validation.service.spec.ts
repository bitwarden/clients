import { mock } from "jest-mock-extended";

import { ErrorResponse } from "../../models/response/error.response";
import { I18nService } from "../abstractions/i18n.service";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";

import { ValidationService } from "./validation.service";

describe("ValidationService", () => {
  let service: ValidationService;
  const i18nService = mock<I18nService>();
  const platformUtilsService = mock<PlatformUtilsService>();

  beforeEach(() => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key: string) => {
      if (key === "unexpectedError") {
        return "An unexpected error has occurred.";
      }
      if (key === "errorOccurred") {
        return "An error has occurred.";
      }
      return key;
    });
    service = new ValidationService(i18nService, platformUtilsService);
  });

  describe("showError", () => {
    it("shows string errors directly", () => {
      const result = service.showError("Something went wrong");

      expect(result).toEqual(["Something went wrong"]);
      expect(platformUtilsService.showToast).toHaveBeenCalledWith(
        "error",
        "An error has occurred.",
        "Something went wrong",
      );
    });

    it("shows default error message for null data", () => {
      const result = service.showError(null);

      expect(result).toEqual(["An unexpected error has occurred."]);
    });

    it("shows default error message for undefined data", () => {
      const result = service.showError(undefined);

      expect(result).toEqual(["An unexpected error has occurred."]);
    });

    it("shows validation errors from ErrorResponse objects", () => {
      const errorResponse = new ErrorResponse(
        {
          message: "The model state is invalid.",
          validationErrors: {
            Notes: [
              "The field Notes exceeds the maximum encrypted value length of 10000 characters.",
            ],
          },
        },
        400,
      );

      const result = service.showError(errorResponse);

      expect(result).toEqual([
        "The field Notes exceeds the maximum encrypted value length of 10000 characters.",
      ]);
    });

    it("shows ErrorResponse message when no validation errors exist", () => {
      const errorResponse = new ErrorResponse(
        {
          message: "Something failed.",
        },
        500,
      );

      const result = service.showError(errorResponse);

      expect(result).toEqual(["Something failed."]);
    });

    it("extracts validation errors from SDK-style error messages", () => {
      const sdkError = new Error(
        '[400 Bad Request] {"message":"The model state is invalid.","validationErrors":{"Notes":["The field Notes exceeds the maximum encrypted value length of 10000 characters."]},"exceptionMessage":null,"exceptionStackTrace":null,"innerExceptionMessage":null,"object":"error"}',
      );

      const result = service.showError(sdkError);

      expect(result).toEqual([
        "The field Notes exceeds the maximum encrypted value length of 10000 characters.",
      ]);
      expect(platformUtilsService.showToast).toHaveBeenCalledWith(
        "error",
        "An error has occurred.",
        "The field Notes exceeds the maximum encrypted value length of 10000 characters.",
      );
    });

    it("extracts API message from SDK-style errors without validation errors", () => {
      const sdkError = new Error(
        '[500 Internal Server Error] {"message":"An internal error occurred.","validationErrors":null,"object":"error"}',
      );

      const result = service.showError(sdkError);

      expect(result).toEqual(["An internal error occurred."]);
    });

    it("extracts multiple validation errors from SDK-style error messages", () => {
      const sdkError = new Error(
        '[400 Bad Request] {"message":"The model state is invalid.","validationErrors":{"Name":["Name is required."],"Notes":["The field Notes exceeds the maximum length."]},"object":"error"}',
      );

      const result = service.showError(sdkError);

      expect(result).toEqual(["Name is required.", "The field Notes exceeds the maximum length."]);
      expect(platformUtilsService.showToast).toHaveBeenCalledWith(
        "error",
        "An error has occurred.",
        ["Name is required.", "The field Notes exceeds the maximum length."],
        { timeout: 10000 },
      );
    });

    it("falls back to raw message for errors without embedded JSON", () => {
      const error = new Error("Some plain error message");

      const result = service.showError(error);

      expect(result).toEqual(["Some plain error message"]);
    });

    it("falls back to raw message for errors with invalid JSON", () => {
      const error = new Error("[400 Bad Request] {invalid json");

      const result = service.showError(error);

      expect(result).toEqual(["[400 Bad Request] {invalid json"]);
    });

    it("shows default error message for error objects without a message", () => {
      const result = service.showError({});

      expect(result).toEqual(["An unexpected error has occurred."]);
    });
  });
});
