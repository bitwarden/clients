import { measured } from "./measured";

const TRACK_GROUP = "group";
const TRACK = "track";

class Measured {
  constructor(private readonly value: number) {}

  @measured(TRACK_GROUP, TRACK)
  async resolves(): Promise<number> {
    return this.value;
  }

  @measured(TRACK_GROUP, TRACK)
  async rejects(): Promise<number> {
    throw new Error("rejected");
  }

  @measured(TRACK_GROUP, TRACK)
  returns(): number {
    return this.value;
  }

  @measured(TRACK_GROUP, TRACK)
  throws(): number {
    throw new Error("thrown");
  }
}

function expectRecorded(measureSpy: jest.SpyInstance, name: string) {
  expect(measureSpy).toHaveBeenCalledWith(name, {
    start: expect.any(Number),
    detail: {
      devtools: {
        dataType: "track-entry",
        track: TRACK,
        trackGroup: TRACK_GROUP,
        properties: undefined,
      },
    },
  });
}

describe("measured", () => {
  let measureSpy: jest.SpyInstance;
  const sut = new Measured(42);

  beforeEach(() => {
    measureSpy = jest.spyOn(performance, "measure");
  });

  afterEach(() => {
    measureSpy.mockRestore();
  });

  it("records an async method once its promise resolves", async () => {
    const pending = sut.resolves();
    expect(measureSpy).not.toHaveBeenCalled();

    await expect(pending).resolves.toBe(42);
    expectRecorded(measureSpy, "resolves");
  });

  it("records an async method whose promise rejects", async () => {
    await expect(sut.rejects()).rejects.toThrow("rejected");
    expectRecorded(measureSpy, "rejects");
  });

  it("records a sync method", () => {
    expect(sut.returns()).toBe(42);
    expectRecorded(measureSpy, "returns");
  });

  it("records a sync method that throws", () => {
    expect(() => sut.throws()).toThrow("thrown");
    expectRecorded(measureSpy, "throws");
  });

  it("calls through when the User Timing API is unavailable", async () => {
    const measure = performance.measure;
    (performance as any).measure = undefined;

    try {
      await expect(sut.resolves()).resolves.toBe(42);
      expect(sut.returns()).toBe(42);
    } finally {
      performance.measure = measure;
    }
  });
});
