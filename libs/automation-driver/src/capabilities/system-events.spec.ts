import { SystemEventsCapability } from "./system-events";

describe("SystemEventsCapability", () => {
  describe("lockScreen", () => {
    it("resolves after the client-supplied handler", async () => {
      let handled = false;
      const lockScreen = jest.fn(async () => {
        handled = true;
      });

      await new SystemEventsCapability(lockScreen).lockScreen();

      expect(lockScreen).toHaveBeenCalledTimes(1);
      expect(handled).toBe(true);
    });

    it("rejects when the client-supplied handler rejects", async () => {
      const lockScreen = jest.fn().mockRejectedValue(new Error("not handled"));

      await expect(new SystemEventsCapability(lockScreen).lockScreen()).rejects.toThrow(
        "not handled",
      );
    });
  });
});
