import { AutomationCapability } from "./automation-capability";
import { AutomationDriver } from "./automation-driver.service";

describe("AutomationDriver", () => {
  /** Stand-in for a real capability; the registry only cares about the name. */
  class FakeCapability extends AutomationCapability {
    constructor(readonly automationName: string) {
      super();
    }
  }

  const capability = (name: string) => new FakeCapability(name);

  describe("get", () => {
    it("returns a registered capability by name", () => {
      const lock = capability("lock");
      const sut = new AutomationDriver([lock, capability("state")]);

      expect(sut.get("lock")).toBe(lock);
    });

    it("returns undefined for a capability the client does not provide", () => {
      const sut = new AutomationDriver([capability("lock")]);

      expect(sut.get("desktopNavigation")).toBeUndefined();
    });
  });

  describe("list", () => {
    it("lists every registered capability name", () => {
      const sut = new AutomationDriver([capability("lock"), capability("state")]);

      expect(sut.list()).toEqual(["lock", "state"]);
    });

    it("is empty when nothing is registered", () => {
      expect(new AutomationDriver([]).list()).toEqual([]);
    });
  });

  it("rejects two capabilities claiming the same name", () => {
    expect(() => new AutomationDriver([capability("lock"), capability("lock")])).toThrow(
      "Duplicate automation capability name: lock",
    );
  });

  describe("attachToGlobal", () => {
    it("attaches the driver", () => {
      const global: any = {};
      const sut = new AutomationDriver([]);

      sut.attachToGlobal(global);

      expect(global.bitwardenAutomationDriver).toBe(sut);
    });

    it("does not replace an already attached driver", () => {
      const existing = {};
      const global: any = { bitwardenAutomationDriver: existing };

      new AutomationDriver([]).attachToGlobal(global);

      expect(global.bitwardenAutomationDriver).toBe(existing);
    });
  });
});
