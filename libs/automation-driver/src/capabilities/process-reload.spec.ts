import { ProcessReloadCapability } from "./process-reload";

describe("ProcessReloadCapability", () => {
  it("delegates to the client-supplied reload", async () => {
    const reload = jest.fn();

    await new ProcessReloadCapability({ reload }).reload();

    expect(reload).toHaveBeenCalled();
  });

  it("turns reloads off", async () => {
    const setEnabled = jest.fn();

    await new ProcessReloadCapability({ reload: jest.fn(), setEnabled }).disable();

    expect(setEnabled).toHaveBeenCalledWith(false);
  });

  it("turns reloads back on", async () => {
    const setEnabled = jest.fn();

    await new ProcessReloadCapability({ reload: jest.fn(), setEnabled }).enable();

    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it("reports a client that cannot suppress its reloads", async () => {
    await expect(new ProcessReloadCapability({ reload: jest.fn() }).disable()).rejects.toThrow(
      "cannot suppress",
    );
  });
});
