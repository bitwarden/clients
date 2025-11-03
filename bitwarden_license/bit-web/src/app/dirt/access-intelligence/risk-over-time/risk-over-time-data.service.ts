import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";

import { RiskMetricType, TimePeriod, RiskOverTimeData } from "./risk-over-time.models";

/**
 * Service for managing risk over time data
 * This service provides data for the risk over time chart component
 */
@Injectable()
export class RiskOverTimeDataService {
  /**
   * Get risk over time data for a specific metric and time period
   * TODO: Replace with actual API call once backend endpoint is ready
   */
  getRiskOverTimeData(metric: RiskMetricType, period: TimePeriod): Observable<RiskOverTimeData> {
    // Mock data for demonstration
    // In production, this should call an API endpoint
    return of(this.getMockData(metric, period));
  }

  /**
   * Generate mock data for development/testing
   * This should be replaced with actual API calls once the backend is ready
   */
  private getMockData(metric: RiskMetricType, period: TimePeriod): RiskOverTimeData {
    const data: RiskOverTimeData = {
      labels: [],
      currentPeriod: [],
      previousPeriod: [],
      metricType: metric,
      timePeriod: period,
    };

    switch (period) {
      case TimePeriod.ThreeMonths:
        data.labels = ["Sep", "Oct", "Nov"];
        break;
      case TimePeriod.SixMonths:
        data.labels = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        break;
      case TimePeriod.TwelveMonths:
        data.labels = ["Jan", "Mar", "May", "Jul", "Sep", "Nov"];
        break;
    }

    // Generate mock data points based on metric type
    const dataPointCount = data.labels.length;

    switch (metric) {
      case RiskMetricType.Applications:
        // Mock data showing improvement (downward trend)
        data.currentPeriod = this.generateTrendData(dataPointCount, 45, 30, true);
        data.previousPeriod = this.generateTrendData(dataPointCount, 50, 35, true);
        break;

      case RiskMetricType.Items:
        // Mock data showing worsening (upward trend)
        data.currentPeriod = this.generateTrendData(dataPointCount, 30, 50, false);
        data.previousPeriod = this.generateTrendData(dataPointCount, 25, 40, false);
        break;

      case RiskMetricType.Members:
        // Mock data showing slight improvement
        data.currentPeriod = this.generateTrendData(dataPointCount, 60, 50, true);
        data.previousPeriod = this.generateTrendData(dataPointCount, 65, 55, true);
        break;
    }

    return data;
  }

  /**
   * Generate trend data with some variation
   * @param count Number of data points
   * @param start Starting value
   * @param end Ending value
   * @param improving Whether trend is improving (downward) or worsening (upward)
   */
  private generateTrendData(
    count: number,
    start: number,
    end: number,
    improving: boolean,
  ): number[] {
    const data: number[] = [];
    const step = (end - start) / (count - 1);

    for (let i = 0; i < count; i++) {
      // Add some random variation to make it look more realistic
      const baseValue = start + step * i;
      const variation = (Math.random() - 0.5) * 5; // +/- 2.5
      data.push(Math.max(0, Math.round(baseValue + variation)));
    }

    return data;
  }

  /**
   * Calculate if a trend is improving based on first and last values
   */
  isImproving(data: number[]): boolean {
    if (data.length < 2) {
      return true;
    }
    return data[data.length - 1] < data[0];
  }

  /**
   * Get the percentage change between two values
   */
  getPercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) {
      return 0;
    }
    return Math.round(((newValue - oldValue) / oldValue) * 100);
  }
}
