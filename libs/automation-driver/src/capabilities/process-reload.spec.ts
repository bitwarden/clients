import { ProcessReloadCapability } from "./process-reload";

describe("ProcessReloadCapability", () => {
  it("delegates to the client-supplied reload", async () => {
    const reloadProcess = jest.fn();

    await new ProcessReloadCapability(reloadProcess).reload();

    expect(reloadProcess).toHaveBeenCalled();
  });
});
