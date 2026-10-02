import { CoachmarkStep, CoachmarkTour } from "./coachmark-tour";

describe("CoachmarkTour", () => {
  const steps: CoachmarkStep<"a" | "b" | "c">[] = [
    { id: "a", position: "below-end" },
    { id: "b" },
    { id: "c" },
  ];

  it("is idle until started", () => {
    const tour = new CoachmarkTour(steps);

    expect(tour.running()).toBe(false);
    expect(tour.stepNumber()).toBe(0);
    expect(tour.isActive("a")).toBe(false);
  });

  it("walks forward and back through the steps", () => {
    const tour = new CoachmarkTour(steps);

    tour.start();
    expect(tour.isActive("a")).toBe(true);
    expect(tour.stepNumber()).toBe(1);
    expect(tour.totalSteps()).toBe(3);

    tour.next();
    expect(tour.isActive("b")).toBe(true);

    tour.back();
    expect(tour.isActive("a")).toBe(true);

    tour.back();
    expect(tour.isActive("a")).toBe(true);
  });

  it("ends from the last step and calls onEnd once", () => {
    const onEnd = jest.fn();
    const tour = new CoachmarkTour(steps, { onEnd });

    tour.start();
    tour.next();
    tour.next();
    tour.next();

    expect(tour.running()).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);

    tour.end();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("skips steps whose `when` fails, and counts only the rest", () => {
    const tour = new CoachmarkTour([{ id: "a", when: () => false }, { id: "b" }, { id: "c" }]);

    tour.start();

    expect(tour.isActive("b")).toBe(true);
    expect(tour.totalSteps()).toBe(2);
  });

  it("doesn't start when no step applies", () => {
    const tour = new CoachmarkTour([{ id: "a", when: () => false }]);

    tour.start();

    expect(tour.running()).toBe(false);
  });

  it("ignores start() while already running", () => {
    const tour = new CoachmarkTour(steps);

    tour.start();
    tour.next();
    tour.start();

    expect(tour.isActive("b")).toBe(true);
  });

  it("runs beforeEnter before the step activates and afterLeave when leaving it", () => {
    const calls: string[] = [];
    let tour: CoachmarkTour = new CoachmarkTour([]);
    tour = new CoachmarkTour([
      { id: "a" },
      {
        id: "b",
        beforeEnter: () => calls.push(`enter b, active a: ${tour.isActive("a")}`),
        afterLeave: () => calls.push("leave b"),
      },
    ]);

    tour.start();
    tour.next();
    tour.back();
    tour.next();
    tour.end();

    expect(calls).toEqual([
      "enter b, active a: true",
      "leave b",
      "enter b, active a: true",
      "leave b",
    ]);
  });

  it("looks up a step's position", () => {
    const tour = new CoachmarkTour(steps);

    expect(tour.position("a")).toBe("below-end");
    expect(tour.position("b")).toBeUndefined();
  });
});
