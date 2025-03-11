import { mock, MockProxy } from "jest-mock-extended";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";

import { BillingNotificationService } from "./billing-notification.service";

describe("BillingNotificationService", () => {
  let service: BillingNotificationService;
  let logService: MockProxy<LogService>;
  let toastService: MockProxy<ToastService>;

  beforeEach(() => {
    logService = mock<LogService>();
    toastService = mock<ToastService>();
    service = new BillingNotificationService(logService, toastService);
  });

  describe("handleError", () => {
    it("should log error and show toast for ErrorResponse", () => {
      const error = new ErrorResponse(["test error"], 400);

      expect(() => service.handleError(error)).toThrow();
      expect(logService.error).toHaveBeenCalledWith(error);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: error.getSingleMessage(),
      });
    });

    it("shows error toast with the provided error", () => {
      const error = new ErrorResponse(["test error"], 400);

      expect(() => service.handleError(error, "Test Title")).toThrow();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Test Title",
        message: error.getSingleMessage(),
      });
    });

    it("should only log error for non-ErrorResponse", () => {
      const error = new Error("test error");

      expect(() => service.handleError(error)).toThrow();
      expect(logService.error).toHaveBeenCalledWith(error);
      expect(toastService.showToast).not.toHaveBeenCalled();
    });
  });

  describe("showSuccess", () => {
    it("shows success toast with default title when provided title is empty", () => {
      const message = "test message";
      service.showSuccess(message);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "",
        message,
      });
    });

    it("should show success toast with custom title", () => {
      const message = "test message";
      service.showSuccess(message, "Success Title");

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "Success Title",
        message,
      });
    });
  });
});
