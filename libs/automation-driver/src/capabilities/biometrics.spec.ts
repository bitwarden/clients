import { mock } from "jest-mock-extended";

import { ToastService } from "@bitwarden/components";

import {
  AutomationBiometricRequestInfo,
  AutomationBiometricsController,
  BiometricsCapability,
} from "./biometrics";

describe("BiometricsCapability", () => {
  let controller: ReturnType<typeof mock<AutomationBiometricsController>>;
  let toastService: ReturnType<typeof mock<ToastService>>;
  let sut: BiometricsCapability;

  beforeEach(() => {
    controller = mock<AutomationBiometricsController>();
    controller.approve.mockResolvedValue([]);
    controller.deny.mockResolvedValue([]);
    toastService = mock<ToastService>();
    sut = new BiometricsCapability(controller, toastService);
  });

  it("sets the mocked status", async () => {
    await sut.setStatus(1);

    expect(controller.setStatus).toHaveBeenCalledWith(1);
  });

  it("lists pending requests", async () => {
    controller.listPending.mockResolvedValue([]);

    await expect(sut.listPending()).resolves.toEqual([]);
  });

  it("approves a request by id", async () => {
    await sut.approve("request-id");

    expect(controller.approve).toHaveBeenCalledWith("request-id");
  });

  it("denies a request by id", async () => {
    await sut.deny("request-id");

    expect(controller.deny).toHaveBeenCalledWith("request-id");
  });

  it("shows a toast when a request starts awaiting approval", () => {
    const [notifyRequest] = controller.onRequest.mock.calls[0];

    notifyRequest({ id: "1", type: "unlock" });

    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "info",
      title: "Automation biometrics",
      message: "Pending unlock request 1",
    });
  });

  it("shows a toast per approved request", async () => {
    const approved: AutomationBiometricRequestInfo[] = [{ id: "1", type: "authenticate" }];
    controller.approve.mockResolvedValue(approved);

    await sut.approve();

    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "Automation biometrics",
      message: "Approved authenticate request 1",
    });
  });

  it("shows a toast per denied request", async () => {
    const denied: AutomationBiometricRequestInfo[] = [{ id: "2", type: "unlock" }];
    controller.deny.mockResolvedValue(denied);

    await sut.deny("2");

    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "warning",
      title: "Automation biometrics",
      message: "Denied unlock request 2",
    });
  });
});
