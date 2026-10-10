import { LiveAnnouncer } from "@angular/cdk/a11y";
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { ToastrService } from "ngx-toastr";

import { ToastService } from "./toast.service";

describe("ToastService", () => {
  let service: ToastService;
  let toastrService: MockProxy<ToastrService>;
  let liveAnnouncer: MockProxy<LiveAnnouncer>;

  beforeEach(() => {
    toastrService = mock<ToastrService>();
    liveAnnouncer = mock<LiveAnnouncer>();

    TestBed.configureTestingModule({
      providers: [
        ToastService,
        { provide: ToastrService, useValue: toastrService },
        { provide: LiveAnnouncer, useValue: liveAnnouncer },
      ],
    });

    service = TestBed.inject(ToastService);
  });

  it("should show toast visual notification via toastrService", () => {
    service.showToast({
      message: "Password copied",
      variant: "success",
      title: "Success",
    });

    expect(toastrService.show).toHaveBeenCalledWith(
      undefined,
      "Success",
      expect.objectContaining({
        payload: {
          message: "Password copied",
          variant: "success",
          title: "Success",
        },
      }),
    );
  });

  it("should announce polite screen reader message for success variant", () => {
    service.showToast({
      message: "Item copied",
      variant: "success",
    });

    expect(liveAnnouncer.announce).toHaveBeenCalledWith("Item copied", "polite");
  });

  it("should announce assertive screen reader message for error variant", () => {
    service.showToast({
      message: "Failed to copy password",
      variant: "error",
    });

    expect(liveAnnouncer.announce).toHaveBeenCalledWith("Failed to copy password", "assertive");
  });

  it("should include title in announcement when present", () => {
    service.showToast({
      title: "Warning",
      message: "Clipboard will clear in 10 seconds",
      variant: "warning",
    });

    expect(liveAnnouncer.announce).toHaveBeenCalledWith(
      "Warning: Clipboard will clear in 10 seconds",
      "polite",
    );
  });

  it("should format array message by joining elements", () => {
    service.showToast({
      message: ["Line 1", "Line 2"],
      variant: "info",
    });

    expect(liveAnnouncer.announce).toHaveBeenCalledWith("Line 1 Line 2", "polite");
  });

  it("should not announce empty or whitespace message", () => {
    service.showToast({
      message: "   ",
      variant: "info",
    });

    expect(liveAnnouncer.announce).not.toHaveBeenCalled();
  });

  it("should announce title alone if message is empty", () => {
    service.showToast({
      title: "Done",
      message: "",
      variant: "success",
    });

    expect(liveAnnouncer.announce).toHaveBeenCalledWith("Done", "polite");
  });

  it("should function without throwing if LiveAnnouncer is not provided", () => {
    const standaloneService = new ToastService(toastrService, undefined);
    expect(() => {
      standaloneService.showToast({
        message: "Standalone test",
        variant: "success",
      });
    }).not.toThrow();
    expect(toastrService.show).toHaveBeenCalled();
  });
});
