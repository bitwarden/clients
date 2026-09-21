import { mock } from "jest-mock-extended";

import { AutomationBiometricsController, BiometricsCapability } from "./biometrics";

describe("BiometricsCapability", () => {
  let controller: ReturnType<typeof mock<AutomationBiometricsController>>;
  let sut: BiometricsCapability;

  beforeEach(() => {
    controller = mock<AutomationBiometricsController>();
    sut = new BiometricsCapability(controller);
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
});
