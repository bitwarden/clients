import { mock } from "jest-mock-extended";

import {
  AutomationBiometricActivity,
  AutomationBiometricsController,
  BiometricsCapability,
} from "./biometrics";

describe("BiometricsCapability", () => {
  let controller: ReturnType<typeof mock<AutomationBiometricsController>>;
  let notify: jest.Mock<void, [string]>;
  let emit: (activity: AutomationBiometricActivity) => void;
  let sut: BiometricsCapability;

  beforeEach(() => {
    controller = mock<AutomationBiometricsController>();
    controller.onEvent.mockImplementation((listener) => {
      emit = listener;
    });
    notify = jest.fn();
    sut = new BiometricsCapability(controller, notify);
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

  it.each([
    ["requested", "Biometrics requested to automation (unlock #1)"],
    ["approved", "Automation approved biometrics (unlock #1)"],
    ["denied", "Automation denied biometrics (unlock #1)"],
  ] as [AutomationBiometricActivity["type"], string][])(
    "notifies when a request is %s",
    (type, message) => {
      emit({ type, request: { id: "1", type: "unlock" } });

      expect(notify).toHaveBeenCalledWith(message);
    },
  );
});
