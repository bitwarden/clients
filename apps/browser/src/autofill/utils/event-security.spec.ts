import { EventSecurity } from "./event-security";

describe("EventSecurity", () => {
  describe("isEventTrusted", () => {
    it("should call the event.isTrusted property", () => {
      const testEvent = new KeyboardEvent("keyup", { code: "Escape" });
      const result = EventSecurity.isEventTrusted(testEvent);

      // In test environment, events are untrusted by default
      expect(result).toBe(false);
      expect(result).toBe(testEvent.isTrusted);
    });

    it("should be mockable with jest.spyOn", () => {
      const testEvent = new KeyboardEvent("keyup", { code: "Escape" });
      const spy = jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);

      const result = EventSecurity.isEventTrusted(testEvent);

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith(testEvent);

      spy.mockRestore();
    });
  });
});
