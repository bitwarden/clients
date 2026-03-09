import { ToastService } from "./toast.service";
import { PausableTimer, calculateToastTimeout } from "./utils";

describe("PausableTimer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fires the callback after the given duration", () => {
    const cb = jest.fn();
    new PausableTimer(cb, 1000);

    jest.advanceTimersByTime(999);
    expect(cb).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not fire again after completing", () => {
    const cb = jest.fn();
    new PausableTimer(cb, 1000);

    jest.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  describe("pause()", () => {
    it("prevents the callback from firing while paused", () => {
      const cb = jest.fn();
      const timer = new PausableTimer(cb, 1000);

      jest.advanceTimersByTime(500);
      timer.pause();
      jest.advanceTimersByTime(1000);

      expect(cb).not.toHaveBeenCalled();
    });

    it("is a no-op when already paused", () => {
      const cb = jest.fn();
      const timer = new PausableTimer(cb, 1000);

      timer.pause();
      timer.pause(); // second call should not throw or change state

      jest.advanceTimersByTime(2000);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe("resume()", () => {
    it("fires the callback after the remaining duration", () => {
      const cb = jest.fn();
      const timer = new PausableTimer(cb, 1000);

      jest.advanceTimersByTime(400);
      timer.pause();
      jest.advanceTimersByTime(9999); // time passes while paused — should not fire

      timer.resume();
      jest.advanceTimersByTime(599);
      expect(cb).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("is a no-op when already running", () => {
      const cb = jest.fn();
      const timer = new PausableTimer(cb, 1000);

      timer.resume(); // already running — should not reset the timer

      jest.advanceTimersByTime(1000);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancel()", () => {
    it("prevents the callback from ever firing", () => {
      const cb = jest.fn();
      const timer = new PausableTimer(cb, 1000);

      timer.cancel();
      jest.advanceTimersByTime(10000);

      expect(cb).not.toHaveBeenCalled();
    });

    it("is a no-op when already cancelled", () => {
      const cb = jest.fn();
      const timer = new PausableTimer(cb, 1000);

      timer.cancel();
      timer.cancel(); // should not throw

      jest.advanceTimersByTime(10000);
      expect(cb).not.toHaveBeenCalled();
    });

    it("prevents the callback from firing even when cancelled while paused", () => {
      const cb = jest.fn();
      const timer = new PausableTimer(cb, 1000);

      timer.pause();
      timer.cancel();
      timer.resume(); // should not restart the timer

      jest.advanceTimersByTime(10000);
      expect(cb).not.toHaveBeenCalled();
    });
  });
});

describe("ToastService", () => {
  let service: ToastService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new ToastService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("showToast()", () => {
    it("adds a toast to the signal", () => {
      service.showToast({ message: "Hello" });
      expect(service.toasts()).toHaveLength(1);
      expect(service.toasts()[0].message).toBe("Hello");
    });

    it("defaults variant to 'info'", () => {
      service.showToast({ message: "Hello" });
      expect(service.toasts()[0].variant).toBe("info");
    });

    it("uses the provided variant", () => {
      service.showToast({ message: "Uh oh", variant: "error" });
      expect(service.toasts()[0].variant).toBe("error");
    });

    it("auto-dismisses after the default timeout", () => {
      service.showToast({ message: "Hello" });
      jest.advanceTimersByTime(4999);
      expect(service.toasts()).toHaveLength(1);
      jest.advanceTimersByTime(1);
      expect(service.toasts()).toHaveLength(0);
    });

    it("auto-dismisses after an explicit timeout", () => {
      service.showToast({ message: "Hello", timeout: 2000 });
      jest.advanceTimersByTime(1999);
      expect(service.toasts()).toHaveLength(1);
      jest.advanceTimersByTime(1);
      expect(service.toasts()).toHaveLength(0);
    });

    it("generates unique ids for each toast", () => {
      service.showToast({ message: "A" });
      service.showToast({ message: "B" });
      const [a, b] = service.toasts();
      expect(a.id).not.toBe(b.id);
    });

    it("pauses existing timers when a new toast is added", () => {
      service.showToast({ message: "First", timeout: 5000 });

      // Advance partway through the first toast's timer
      jest.advanceTimersByTime(4000);
      expect(service.toasts()).toHaveLength(1);

      // Second toast pauses the first's timer
      service.showToast({ message: "Second", timeout: 5000 });
      expect(service.toasts()).toHaveLength(2);

      // Advance well past when the first toast would have fired — it should not dismiss
      jest.advanceTimersByTime(5000);
      expect(service.toasts()).toHaveLength(1); // only second dismissed itself
      expect(service.toasts()[0].message).toBe("First");
    });

    it("pauses a new toast immediately when the container is hover-paused", () => {
      service.pause();
      service.showToast({ message: "Hello", timeout: 1000 });

      jest.advanceTimersByTime(2000);
      // Timer should not have fired while paused
      expect(service.toasts()).toHaveLength(1);
    });
  });

  describe("remove()", () => {
    it("removes the specified toast", () => {
      service.showToast({ message: "A" });
      const id = service.toasts()[0].id;
      service.remove(id);
      expect(service.toasts()).toHaveLength(0);
    });

    it("cancels the removed toast's timer", () => {
      service.showToast({ message: "A", timeout: 1000 });
      const id = service.toasts()[0].id;
      service.remove(id);

      // Advance past what the timer would have been — no double-remove crash
      jest.advanceTimersByTime(2000);
      expect(service.toasts()).toHaveLength(0);
    });

    it("resumes the new top toast's timer after removal", () => {
      service.showToast({ message: "First", timeout: 3000 });
      // Second toast pauses first's timer
      service.showToast({ message: "Second", timeout: 5000 });

      // Remove the top (second) toast — first's timer should resume
      service.remove(service.toasts()[1].id);
      expect(service.toasts()).toHaveLength(1);

      // First had 3000ms total; its timer was paused at ~0ms elapsed, so ~3000ms remaining
      jest.advanceTimersByTime(2999);
      expect(service.toasts()).toHaveLength(1);
      jest.advanceTimersByTime(1);
      expect(service.toasts()).toHaveLength(0);
    });

    it("is a no-op for an unknown id", () => {
      service.showToast({ message: "A" });
      service.remove("unknown-id");
      expect(service.toasts()).toHaveLength(1);
    });
  });

  describe("pause() / resume()", () => {
    it("pause() stops the top toast's timer", () => {
      service.showToast({ message: "Hello", timeout: 1000 });
      service.pause();

      jest.advanceTimersByTime(2000);
      expect(service.toasts()).toHaveLength(1);
    });

    it("resume() restarts the top toast's timer from remaining time", () => {
      service.showToast({ message: "Hello", timeout: 1000 });

      jest.advanceTimersByTime(600);
      service.pause();
      jest.advanceTimersByTime(9999); // time passes while paused

      service.resume();
      jest.advanceTimersByTime(399);
      expect(service.toasts()).toHaveLength(1);
      jest.advanceTimersByTime(1);
      expect(service.toasts()).toHaveLength(0);
    });

    it("resume() only restarts the top toast, not hidden ones", () => {
      service.showToast({ message: "First", timeout: 3000 });
      service.showToast({ message: "Second", timeout: 5000 });

      // Hover and un-hover
      service.pause();
      service.resume();

      // First's timer should still be paused — only second is counting down
      jest.advanceTimersByTime(5000);
      expect(service.toasts()).toHaveLength(1);
      expect(service.toasts()[0].message).toBe("First");
    });

    it("pause() is a no-op when already paused", () => {
      service.showToast({ message: "Hello", timeout: 1000 });
      service.pause();
      service.pause(); // should not throw
      service.resume();

      jest.advanceTimersByTime(1000);
      expect(service.toasts()).toHaveLength(0);
    });

    it("resume() is a no-op when not paused", () => {
      service.showToast({ message: "Hello", timeout: 1000 });
      service.resume(); // should not throw or reset timer

      jest.advanceTimersByTime(1000);
      expect(service.toasts()).toHaveLength(0);
    });
  });

  describe("_showToast() deprecated adapter", () => {
    it("maps type → variant and text → message", () => {
      service._showToast({ type: "success", title: "Done", text: "Item saved" });
      expect(service.toasts()).toHaveLength(1);
      expect(service.toasts()[0].variant).toBe("success");
      expect(service.toasts()[0].message).toBe("Item saved");
    });

    it("accepts string[] for text", () => {
      service._showToast({ type: "error", title: "Oops", text: ["Line 1", "Line 2"] });
      expect(service.toasts()[0].message).toEqual(["Line 1", "Line 2"]);
    });

    it("forwards custom timeout", () => {
      service._showToast({
        type: "info",
        title: "",
        text: "Hello",
        options: { timeout: 2000 },
      });
      jest.advanceTimersByTime(1999);
      expect(service.toasts()).toHaveLength(1);
      jest.advanceTimersByTime(1);
      expect(service.toasts()).toHaveLength(0);
    });
  });
});

describe("Toast default timer", () => {
  it("should have a minimum of 5000ms", () => {
    expect(calculateToastTimeout("")).toBe(5000);
    expect(calculateToastTimeout([""])).toBe(5000);
    expect(calculateToastTimeout(" ")).toBe(5000);
  });

  it("should return an extra second for each 120 words", () => {
    expect(calculateToastTimeout("foo ".repeat(119))).toBe(5000);
    expect(calculateToastTimeout("foo ".repeat(120))).toBe(6000);
    expect(calculateToastTimeout("foo ".repeat(240))).toBe(7000);
    expect(calculateToastTimeout(["foo ".repeat(120), " \n foo ".repeat(120)])).toBe(7000);
  });
});
