import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class SsoFlowMetricsService {
  mark(name: string): void {
    try {
      if (typeof performance !== "undefined" && typeof performance.mark === "function") {
        performance.mark(name);
      }
    } catch {
      // no-op
    }
  }

  measure(name: string, startMark: string, endMark: string): PerformanceMeasure | undefined {
    try {
      if (
        typeof performance !== "undefined" &&
        typeof performance.measure === "function" &&
        typeof performance.getEntriesByName === "function"
      ) {
        // Clear any previous measure with same name
        (performance.getEntriesByName(name, "measure") as PerformanceMeasure[]).forEach((m) =>
          performance.clearMeasures(m.name),
        );
        const measure = performance.measure(name, startMark, endMark);
        return measure as PerformanceMeasure;
      }
    } catch {
      // no-op
    }
    return undefined;
  }
}


