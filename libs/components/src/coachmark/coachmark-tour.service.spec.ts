import {
  CoachmarkStep,
  CoachmarkTourOptions,
  CoachmarkTourService,
} from "./coachmark-tour.service";

const anchor = document.createElement("div");

function createTour(
  steps: readonly Omit<CoachmarkStep, "anchor">[],
  options?: CoachmarkTourOptions,
): CoachmarkTourService {
  const tour = new CoachmarkTourService();
  tour.configure(
    steps.map((step) => ({ ...step, anchor })),
    options,
  );
  return tour;
}

describe("CoachmarkTourService", () => {
  const steps: Omit<CoachmarkStep, "anchor">[] = [
    { id: "a", position: "below-end" },
    { id: "b" },
    { id: "c" },
  ];

  it("is idle until started", () => {
    const tour = createTour(steps);

    expect(tour.running()).toBe(false);
    expect(tour.stepNumber()).toBe(0);
    expect(tour.isActive("a")).toBe(false);
  });

  it("walks forward and back through the steps", () => {
    const tour = createTour(steps);

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
    const tour = createTour(steps, { onEnd });

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
    const tour = createTour([{ id: "a", when: () => false }, { id: "b" }, { id: "c" }]);

    tour.start();

    expect(tour.isActive("b")).toBe(true);
    expect(tour.totalSteps()).toBe(2);
  });

  it("doesn't start when no step applies", () => {
    const tour = createTour([{ id: "a", when: () => false }]);

    tour.start();

    expect(tour.running()).toBe(false);
  });

  it("ignores start() while already running", () => {
    const tour = createTour(steps);

    tour.start();
    tour.next();
    tour.start();

    expect(tour.isActive("b")).toBe(true);
  });

  it("runs beforeEnter before the step activates and afterLeave when leaving it", () => {
    const calls: string[] = [];
    const tour: CoachmarkTourService = createTour([
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

  it("exposes the active step's anchor and position", () => {
    const tour = createTour(steps);

    tour.start();

    expect(tour.activeStep()).toMatchObject({ anchor, position: "below-end" });
  });

  it("doesn't start before it's configured", () => {
    const tour = new CoachmarkTourService();

    tour.start();

    expect(tour.running()).toBe(false);
  });
});
