import { mock } from "jest-mock-extended";

import { ToastService } from "@bitwarden/components";

import { AutomationWebAuthnController, WebAuthnCapability } from "./webauthn";

describe("WebAuthnCapability", () => {
  let controller: ReturnType<typeof mock<AutomationWebAuthnController>>;
  let toastService: ReturnType<typeof mock<ToastService>>;
  let sut: WebAuthnCapability;

  beforeEach(() => {
    controller = mock<AutomationWebAuthnController>();
    toastService = mock<ToastService>();
    sut = new WebAuthnCapability(controller, toastService);
  });

  it("lists pending requests", async () => {
    controller.listPending.mockResolvedValue([{ id: "1" }]);

    await expect(sut.listPending()).resolves.toEqual([{ id: "1" }]);
  });

  it("answers a request and shows a toast", async () => {
    controller.respond.mockResolvedValue(true);
    const response = { credentialId: "AQ" };

    await expect(sut.respond("1", response)).resolves.toBe(true);

    expect(controller.respond).toHaveBeenCalledWith("1", response);
    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "Automation WebAuthn",
      message: "Answered WebAuthn request 1",
    });
  });

  it("fails a request and shows a toast", async () => {
    controller.reject.mockResolvedValue(true);
    const error = { name: "NotAllowedError", message: "Cancelled" };

    await expect(sut.reject("1", error)).resolves.toBe(true);

    expect(controller.reject).toHaveBeenCalledWith("1", error);
    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "warning",
      title: "Automation WebAuthn",
      message: "Failed WebAuthn request 1 with NotAllowedError",
    });
  });

  it("shows no toast for a request that wasn't waiting", async () => {
    controller.respond.mockResolvedValue(false);

    await expect(sut.respond("1", {})).resolves.toBe(false);

    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it("shows a toast when a request starts waiting", () => {
    const [notifyRequest] = controller.onRequest.mock.calls[0];

    notifyRequest({ id: "1", rpId: "localhost" });

    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "info",
      title: "Automation WebAuthn",
      message: "Pending WebAuthn request 1 for localhost",
    });
  });
});
