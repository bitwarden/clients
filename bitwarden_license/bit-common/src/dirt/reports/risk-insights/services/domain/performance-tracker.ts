/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/**
 * Helper class for tracking performance metrics during report generation
 * Compatible with Firefox and Chrome
 */
export class PerformanceTracker {
  private marks: Map<string, number> = new Map();
  private measurements: Map<string, number> = new Map();

  /**
   * Mark the start of a performance measurement
   */
  mark(name: string): void {
    const timestamp = performance.now();
    this.marks.set(name, timestamp);

    // Also use native Performance API for DevTools integration
    performance.mark(`risk-insights:${name}:start`);

    console.log(`🔵 [Performance] ${name} - START`, {
      timestamp: new Date().toISOString(),
      relativeTime: `${timestamp.toFixed(2)}ms`,
    });
  }

  /**
   * Measure and log the time since the last mark
   */
  measure(name: string, startMark?: string): number {
    const endTime = performance.now();
    const markName = startMark || name;
    const startTime = this.marks.get(markName);

    if (!startTime) {
      console.warn(`⚠️ [Performance] No start mark found for: ${markName}`);
      return 0;
    }

    const duration = endTime - startTime;
    this.measurements.set(name, duration);

    // Create native performance measure for DevTools
    try {
      performance.mark(`risk-insights:${name}:end`);
      performance.measure(
        `risk-insights:${name}`,
        `risk-insights:${markName}:start`,
        `risk-insights:${name}:end`,
      );
    } catch (e) {
      // Ignore if marks don't exist
    }

    const durationSeconds = duration / 1000;
    const emoji = durationSeconds > 5 ? "🔴" : durationSeconds > 2 ? "🟡" : "🟢";

    console.log(`${emoji} [Performance] ${name} - COMPLETE`, {
      duration: `${duration.toFixed(2)}ms`,
      durationSeconds: `${durationSeconds.toFixed(2)}s`,
      timestamp: new Date().toISOString(),
    });

    return duration;
  }

  /**
   * Log intermediate progress without stopping the timer
   */
  checkpoint(baseMark: string, checkpointName: string): void {
    const startTime = this.marks.get(baseMark);
    if (!startTime) {
      console.warn(`⚠️ [Performance] No start mark found for: ${baseMark}`);
      return;
    }

    const elapsed = performance.now() - startTime;
    console.log(`⏱️  [Performance] ${baseMark} → ${checkpointName}`, {
      elapsed: `${elapsed.toFixed(2)}ms`,
      elapsedSeconds: `${(elapsed / 1000).toFixed(2)}s`,
    });
  }

  /**
   * Log item count for tracking data size
   */
  logDataSize(label: string, count: number, additionalInfo?: Record<string, any>): void {
    console.log(`📊 [Performance] Data Size - ${label}`, {
      count,
      ...additionalInfo,
    });
  }

  /**
   * Log a summary of all measurements
   */
  logSummary(): void {
    console.log("═".repeat(60));
    console.log("📈 [Performance] REPORT GENERATION SUMMARY");
    console.log("═".repeat(60));

    const sortedMeasurements = Array.from(this.measurements.entries()).sort(
      ([, durationA], [, durationB]) => durationB - durationA,
    );

    sortedMeasurements.forEach(([name, duration]) => {
      const seconds = duration / 1000;
      const emoji = seconds > 5 ? "🔴" : seconds > 2 ? "🟡" : "🟢";
      console.log(
        `  ${emoji} ${name.padEnd(40)} ${duration.toFixed(2).padStart(10)}ms (${seconds.toFixed(2)}s)`,
      );
    });

    const total = Array.from(this.measurements.values()).reduce((sum, val) => sum + val, 0);
    console.log("─".repeat(60));
    console.log(
      `  💯 TOTAL${" ".repeat(36)} ${total.toFixed(2).padStart(10)}ms (${(total / 1000).toFixed(2)}s)`,
    );
    console.log("═".repeat(60));
  }

  /**
   * Get all measurements for external analysis
   */
  getMeasurements(): Record<string, number> {
    return Object.fromEntries(this.measurements);
  }

  /**
   * Reset all tracking data
   */
  reset(): void {
    this.marks.clear();
    this.measurements.clear();

    // Clear native performance marks
    performance.clearMarks();
    performance.clearMeasures();

    console.log("🔄 [Performance] Tracker reset");
  }
}
