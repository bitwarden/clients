import { TestBed } from "@angular/core/testing";
import type { Tick } from "chart.js";

import { ChartConfig, LineChartComponent } from "./line-chart.component";

describe("LineChartComponent", () => {
  describe("afterBuildTicks hook", () => {
    function getHook(config: Partial<ChartConfig> = {}) {
      TestBed.configureTestingModule({ imports: [LineChartComponent] });
      const fixture = TestBed.createComponent(LineChartComponent);
      const fullConfig: ChartConfig = {
        xAxisType: "datetime",
        timeUnit: "day",
        xMin: new Date(2026, 0, 1),
        xMax: new Date(2026, 0, 31),
        ...config,
      };
      const options = (fixture.componentInstance as any).buildOptions(fullConfig);
      return options.scales.x.afterBuildTicks as (axis: any) => void;
    }

    function makeAxis(opts: { ticks: Tick[]; min?: number; max?: number }) {
      return { ticks: opts.ticks, min: opts.min, max: opts.max };
    }

    it("replaces first tick when axis.min lands within the merge threshold", () => {
      const hook = getHook();
      // Natural interval: 10. Threshold: 6. axis.min is 2 before ticks[0].
      const axis = makeAxis({
        ticks: [
          { value: 12, major: true } as Tick,
          { value: 22, major: false } as Tick,
          { value: 32, major: false } as Tick,
        ],
        min: 10,
        max: 32,
      });

      hook(axis);

      expect(axis.ticks).toHaveLength(3);
      expect(axis.ticks[0].value).toBe(10);
      expect(axis.ticks[0].major).toBe(true); // preserved from the replaced tick
    });

    it("prepends a tick when axis.min is far from the first tick", () => {
      const hook = getHook();
      // Natural interval: 10. Threshold: 6. axis.min is 8 before ticks[0].
      const axis = makeAxis({
        ticks: [
          { value: 20, major: false } as Tick,
          { value: 30, major: false } as Tick,
          { value: 40, major: false } as Tick,
        ],
        min: 12,
        max: 40,
      });

      hook(axis);

      expect(axis.ticks).toHaveLength(4);
      expect(axis.ticks[0].value).toBe(12);
      expect(axis.ticks[0].major).toBe(false);
    });

    it("replaces last tick when axis.max lands within the merge threshold", () => {
      const hook = getHook();
      const axis = makeAxis({
        ticks: [
          { value: 10, major: false } as Tick,
          { value: 20, major: false } as Tick,
          { value: 30, major: true } as Tick,
        ],
        min: 10,
        max: 32, // 2 past last tick, threshold 6 → replace
      });

      hook(axis);

      expect(axis.ticks).toHaveLength(3);
      expect(axis.ticks[2].value).toBe(32);
      expect(axis.ticks[2].major).toBe(true); // preserved
    });

    it("appends a tick when axis.max is far from the last tick", () => {
      const hook = getHook();
      const axis = makeAxis({
        ticks: [
          { value: 10, major: false } as Tick,
          { value: 20, major: false } as Tick,
          { value: 30, major: false } as Tick,
        ],
        min: 10,
        max: 38, // 8 past last tick, threshold 6 → append
      });

      hook(axis);

      expect(axis.ticks).toHaveLength(4);
      expect(axis.ticks[3].value).toBe(38);
      expect(axis.ticks[3].major).toBe(false);
    });

    it("is a no-op on an empty ticks array", () => {
      const hook = getHook();
      const axis = makeAxis({ ticks: [], min: 10, max: 30 });
      hook(axis);
      expect(axis.ticks).toEqual([]);
    });

    it("does not prepend or replace when axis.min is undefined", () => {
      const hook = getHook();
      const axis = makeAxis({
        ticks: [{ value: 10, major: false } as Tick, { value: 20, major: false } as Tick],
        min: undefined,
        max: 30,
      });

      hook(axis);

      expect(axis.ticks[0].value).toBe(10);
      expect(axis.ticks.at(-1)?.value).toBe(30); // axis.max append still applies
    });

    it("handles a single existing tick (avgInterval = 0) by appending without replacing", () => {
      const hook = getHook();
      const axis = makeAxis({
        ticks: [{ value: 10, major: false } as Tick],
        min: 10,
        max: 20,
      });

      hook(axis);

      expect(axis.ticks).toHaveLength(2);
      expect(axis.ticks[0].value).toBe(10);
      expect(axis.ticks[1].value).toBe(20);
    });
  });
});
