import { ComponentFixture, TestBed } from "@angular/core/testing";

import { LineChartComponent, LineData } from "./line-chart.component";

describe("LineChartComponent", () => {
  let component: LineChartComponent;
  let fixture: ComponentFixture<LineChartComponent>;

  beforeEach(async () => {
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    HTMLCanvasElement.prototype.getContext = jest.fn(function (this: HTMLCanvasElement) {
      return {
        canvas: this,
        fillRect: jest.fn(),
        clearRect: jest.fn(),
        getImageData: jest.fn(),
        putImageData: jest.fn(),
        createImageData: jest.fn(),
        setTransform: jest.fn(),
        resetTransform: jest.fn(),
        drawImage: jest.fn(),
        save: jest.fn(),
        fillText: jest.fn(),
        strokeText: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        bezierCurveTo: jest.fn(),
        quadraticCurveTo: jest.fn(),
        closePath: jest.fn(),
        stroke: jest.fn(),
        strokeRect: jest.fn(),
        translate: jest.fn(),
        scale: jest.fn(),
        rotate: jest.fn(),
        arc: jest.fn(),
        ellipse: jest.fn(),
        fill: jest.fn(),
        measureText: jest.fn(() => ({ width: 0 })),
        transform: jest.fn(),
        rect: jest.fn(),
        clip: jest.fn(),
        setLineDash: jest.fn(),
        getLineDash: jest.fn((): number[] => []),
        createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
        createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      };
    }) as any;

    await TestBed.configureTestingModule({
      imports: [LineChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LineChartComponent);
    component = fixture.componentInstance;
  });

  describe("getDateRange", () => {
    it("returns undefined for empty lines array", () => {
      expect((component as any).getDateRange([])).toBeUndefined();
    });

    it("returns undefined when all lines have empty pointData", () => {
      const lines: LineData[] = [{ label: "empty", pointData: [], color: "#000" }];
      expect((component as any).getDateRange(lines)).toBeUndefined();
    });

    it("returns min and max from Date x values", () => {
      const lines: LineData[] = [
        {
          label: "a",
          pointData: [
            { x: new Date("2025-02-01"), y: 10 },
            { x: new Date("2025-04-20"), y: 5 },
          ],
          color: "#000",
        },
        {
          label: "b",
          pointData: [
            { x: new Date("2025-01-15"), y: 3 }, // actual min
          ],
          color: "#fff",
        },
      ];

      const result = (component as any).getDateRange(lines);

      expect(result).toEqual({
        min: new Date("2025-01-15").getTime(),
        max: new Date("2025-04-20").getTime(),
      });
    });

    it("returns min and max from numeric x values", () => {
      const lines: LineData[] = [
        {
          label: "a",
          pointData: [
            { x: 1000, y: 1 },
            { x: 9000, y: 2 },
          ],
          color: "#000",
        },
      ];

      const result = (component as any).getDateRange(lines);
      expect(result).toEqual({ min: 1000, max: 9000 });
    });
  });

  describe("buildOptions", () => {
    it("does not add afterBuildTicks when showMinMaxDates is absent", () => {
      const options = (component as any).buildOptions({ xAxisType: "datetime" });
      expect(options.scales.x.afterBuildTicks).toBeUndefined();
    });

    it("does not add afterBuildTicks when showMinMaxDates is true but no dateRange", () => {
      const options = (component as any).buildOptions({
        xAxisType: "datetime",
        showMinMaxDates: true,
      });
      expect(options.scales.x.afterBuildTicks).toBeUndefined();
    });

    it("adds afterBuildTicks when showMinMaxDates is true and dateRange is provided", () => {
      const options = (component as any).buildOptions(
        { xAxisType: "datetime", showMinMaxDates: true },
        { min: 1000, max: 10000 },
      );
      expect(options.scales.x.afterBuildTicks).toBeInstanceOf(Function);
    });

    it("does not add afterBuildTicks when xAxisType is default even with showMinMaxDates and dateRange", () => {
      const options = (component as any).buildOptions(
        { xAxisType: "default", showMinMaxDates: true },
        { min: 1000, max: 10000 },
      );
      expect(options.scales.x.afterBuildTicks).toBeUndefined();
    });
  });

  describe("afterBuildTicks callback", () => {
    const min = new Date("2025-01-15").getTime();
    const max = new Date("2025-04-20").getTime();
    const range = max - min;
    const threshold = range * 0.1;

    let afterBuildTicks: (scale: { ticks: { value: number }[] }) => void;

    beforeEach(() => {
      const options = (component as any).buildOptions(
        { xAxisType: "datetime", showMinMaxDates: true },
        { min, max },
      );
      afterBuildTicks = options.scales.x.afterBuildTicks;
    });

    it("adds min as first tick and max as last tick on empty ticks array", () => {
      const scale: { ticks: { value: number }[] } = { ticks: [] };
      afterBuildTicks(scale);
      expect(scale.ticks[0].value).toBe(min);
      expect(scale.ticks[scale.ticks.length - 1].value).toBe(max);
    });

    it("preserves auto ticks in the safe middle zone", () => {
      const safeTick = min + range * 0.5;
      const scale: { ticks: { value: number }[] } = { ticks: [{ value: safeTick }] };
      afterBuildTicks(scale);
      const middleTicks = scale.ticks.slice(1, -1);
      expect(middleTicks.some((t) => t.value === safeTick)).toBe(true);
    });

    it("filters auto ticks within 10% of min endpoint", () => {
      const crowdedTick = min + threshold * 0.5;
      const scale: { ticks: { value: number }[] } = { ticks: [{ value: crowdedTick }] };
      afterBuildTicks(scale);
      const middleTicks = scale.ticks.slice(1, -1);
      expect(middleTicks.some((t) => t.value === crowdedTick)).toBe(false);
    });

    it("filters auto ticks within 10% of max endpoint", () => {
      const crowdedTick = max - threshold * 0.5;
      const scale: { ticks: { value: number }[] } = { ticks: [{ value: crowdedTick }] };
      afterBuildTicks(scale);
      const middleTicks = scale.ticks.slice(1, -1);
      expect(middleTicks.some((t) => t.value === crowdedTick)).toBe(false);
    });

    it("produces a single tick when min and max are equal (single-point dataset)", () => {
      const singleTimestamp = new Date("2025-03-01").getTime();
      const singlePointOptions = (component as any).buildOptions(
        { xAxisType: "datetime", showMinMaxDates: true },
        { min: singleTimestamp, max: singleTimestamp },
      );
      const singlePointAfterBuildTicks = singlePointOptions.scales.x.afterBuildTicks;
      const scale: { ticks: { value: number }[] } = {
        ticks: [{ value: singleTimestamp - 1000 }, { value: singleTimestamp + 1000 }],
      };
      singlePointAfterBuildTicks(scale);
      expect(scale.ticks).toHaveLength(1);
      expect(scale.ticks[0].value).toBe(singleTimestamp);
    });
  });
});
