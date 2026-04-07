import { Observable } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { TimePeriod } from "../activity/period-selector/period-selector.types";
import {
  TrendWidgetData,
  TrendWidgetViewType,
} from "../activity/trend-widget/trend-widget.component";

/**
 * Provides risk-over-time trend data for the {@link TrendWidgetComponent}.
 *
 * Call {@link initialize} once before use, then {@link setTimeframe} and {@link setDataView}
 * to update the active filter state.
 */
export abstract class RiskOverTimeService {
  /** Emits the current trend data. Starts with an empty default until the first fetch completes. */
  abstract readonly riskOverTimeData$: Observable<TrendWidgetData>;

  /** Emits `true` while a fetch is in progress. */
  abstract readonly isLoading$: Observable<boolean>;

  /** Emits an error message if the last fetch failed, or `null` otherwise. */
  abstract readonly error$: Observable<string | null>;

  /** Initializes the service for the given organization with the specified default filter state. */
  abstract initialize(
    orgId: OrganizationId,
    timeframe: TimePeriod,
    dataView: TrendWidgetViewType,
  ): void;

  /** Updates the timeframe filter. */
  abstract setTimeframe(timeframe: TimePeriod): void;

  /** Updates the data view filter. */
  abstract setDataView(dataView: TrendWidgetViewType): void;
}
