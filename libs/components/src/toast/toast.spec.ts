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
