import { HOUR, STORY_NOW, fromNow, liveFromNow, startClockAtStoryNow } from "./story-clock";

describe("story clock", () => {
  let real: number;

  beforeEach(() => {
    real = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => real);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("offsets fromNow against STORY_NOW, whatever the real clock reads", () => {
    expect(fromNow(HOUR)).toBe("2026-08-17T13:00:00.000Z");
  });

  it("starts Date.now at STORY_NOW and keeps it running", () => {
    const restore = startClockAtStoryNow();
    expect(Date.now()).toBe(STORY_NOW.getTime());

    real += 5000;
    expect(Date.now()).toBe(STORY_NOW.getTime() + 5000);

    restore();
    expect(Date.now()).toBe(real);
  });

  it("offsets liveFromNow against the moved clock", () => {
    startClockAtStoryNow();
    real += 5000;
    expect(liveFromNow(-HOUR)).toBe("2026-08-17T11:00:05.000Z");
  });
});
