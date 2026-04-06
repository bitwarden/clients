import { Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  BehaviorSubject,
  catchError,
  filter,
  forkJoin,
  map,
  Observable,
  of,
  switchMap,
  take,
  tap,
} from "rxjs";

import {
  AccessReportSummary,
  AccessReportSummaryApi,
  AccessReportSummaryData,
  AccessReportSummaryView,
} from "@bitwarden/bit-common/dirt/access-intelligence/models";
import { AccessReportEncryptionService } from "@bitwarden/bit-common/dirt/access-intelligence/services";
import { RiskInsightsApiService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { TimePeriod } from "../activity/period-selector/period-selector.types";
import {
  TrendWidgetData,
  TrendWidgetViewType,
} from "../activity/trend-widget/trend-widget.component";

import { RiskOverTimeService } from "./risk-over-time.service";

interface FetchTrigger {
  orgId: OrganizationId;
  timeframe: TimePeriod;
  dataView: TrendWidgetViewType;
}

@Injectable()
export class DefaultRiskOverTimeService extends RiskOverTimeService {
  private readonly _defaultRiskOverTimeData: TrendWidgetData = {
    timeframe: TimePeriod.PastMonth,
    dataView: TrendWidgetViewType.Applications,
    dataPoints: [],
  };

  private readonly _riskOverTimeData$ = new BehaviorSubject<TrendWidgetData>(
    this._defaultRiskOverTimeData,
  );
  readonly riskOverTimeData$ = this._riskOverTimeData$.asObservable();

  private readonly _isLoading$ = new BehaviorSubject<boolean>(false);
  readonly isLoading$ = this._isLoading$.asObservable();

  private readonly _error$ = new BehaviorSubject<string | null>(null);
  readonly error$ = this._error$.asObservable();

  private readonly _params$ = new BehaviorSubject<FetchTrigger | null>(null);

  constructor(
    private readonly apiService: RiskInsightsApiService,
    private readonly encryptionService: AccessReportEncryptionService,
    private readonly accountService: AccountService,
    private readonly logService: LogService,
  ) {
    super();

    this._params$
      .pipe(
        filter((params): params is FetchTrigger => params !== null),
        tap(() => {
          this._isLoading$.next(true);
          this._error$.next(null);
        }),
        switchMap(({ orgId, timeframe, dataView }) =>
          this.accountService.activeAccount$.pipe(
            take(1),
            switchMap((account) => {
              if (!account) {
                throw new Error("No active account");
              }
              const { startDate, endDate } = this.getDateRange(timeframe);
              return this.apiService
                .getRiskOverTime$(orgId, startDate, endDate)
                .pipe(
                  switchMap((entries) =>
                    this.decryptAndMap$(entries, orgId, account.id, timeframe, dataView),
                  ),
                );
            }),
            catchError((err: unknown) => {
              const message = err instanceof Error ? err.message : "Failed to load trend data";
              this._error$.next(message);
              this.logService.error(
                `[DefaultRiskOverTimeService] Error fetching risk-over-time data: ${message}`,
              );
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((data: TrendWidgetData | null) => {
        if (data) {
          this._riskOverTimeData$.next(data);
        } else {
          this._riskOverTimeData$.next(this._defaultRiskOverTimeData);
        }
        this._isLoading$.next(false);
      });
  }

  initialize(orgId: OrganizationId, timeframe: TimePeriod, dataView: TrendWidgetViewType): void {
    this._params$.next({ orgId, timeframe, dataView });
  }

  setTimeframe(timeframe: TimePeriod): void {
    const current = this._params$.value;
    if (current) {
      this._params$.next({ ...current, timeframe });
    }
  }

  setDataView(dataView: TrendWidgetViewType): void {
    const current = this._params$.value;
    if (current) {
      this._params$.next({ ...current, dataView });
    }
  }

  private getDateRange(timeframe: TimePeriod): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeframe) {
      case TimePeriod.PastMonth:
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case TimePeriod.Past3Months:
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case TimePeriod.Past6Months:
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case TimePeriod.PastYear:
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case TimePeriod.AllTime:
        startDate.setFullYear(2000);
        break;
    }

    return { startDate, endDate };
  }

  private decryptAndMap$(
    entries: AccessReportSummaryApi[],
    orgId: OrganizationId,
    userId: UserId,
    timeframe: TimePeriod,
    dataView: TrendWidgetViewType,
  ): Observable<TrendWidgetData> {
    if (entries.length === 0) {
      return of({ timeframe, dataView, dataPoints: [] });
    }

    const context = { organizationId: orgId, userId };

    const decryptedViews$ = entries.map((entry) => {
      const data = new AccessReportSummaryData(entry);
      const domain = new AccessReportSummary(data);

      if (!domain.encryptedData || !domain.encryptionKey) {
        this.logService.warning(
          "[DefaultRiskOverTimeService] Summary entry missing encrypted fields, skipping",
        );
        return of(null as AccessReportSummaryView | null);
      }
      return this.encryptionService
        .decryptSummary$(context, domain.encryptedData, domain.encryptionKey)
        .pipe(
          map((view) => {
            view.date = domain.date;
            return view;
          }),
          catchError((err: unknown) => {
            this.logService.error(
              "[DefaultRiskOverTimeService] Failed to decrypt summary entry, skipping",
              err,
            );
            return of(null as AccessReportSummaryView | null);
          }),
        );
    });

    return forkJoin(decryptedViews$).pipe(
      map((views) => {
        const dataPoints = views
          .filter((v): v is AccessReportSummaryView => v !== null)
          .map((view) => ({
            timestamp: view.date.toISOString(),
            atRisk: this.getAtRisk(view, dataView),
            total: this.getTotal(view, dataView),
          }));

        return { timeframe, dataView, dataPoints };
      }),
    );
  }

  private getAtRisk(view: AccessReportSummaryView, dataView: TrendWidgetViewType): number {
    switch (dataView) {
      case TrendWidgetViewType.Applications:
        return view.totalCriticalAtRiskApplicationCount;
      case TrendWidgetViewType.Members:
        return view.totalCriticalAtRiskMemberCount;
      case TrendWidgetViewType.Passwords:
        return view.totalCriticalAtRiskPasswordCount;
    }
  }

  private getTotal(view: AccessReportSummaryView, dataView: TrendWidgetViewType): number {
    switch (dataView) {
      case TrendWidgetViewType.Applications:
        return view.totalCriticalApplicationCount;
      case TrendWidgetViewType.Members:
        return view.totalCriticalMemberCount;
      case TrendWidgetViewType.Passwords:
        return view.totalCriticalPasswordCount;
    }
  }
}
