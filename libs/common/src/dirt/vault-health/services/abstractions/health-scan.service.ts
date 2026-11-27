import { Observable } from "rxjs";

import { UserId } from "../../../../types/guid";

/**
 * Decides when the Health views recompute their report; `VaultHealthReportService` owns what
 * the report is. Scans are scoped to the subscriber and nothing here throws.
 */
export abstract class HealthScanService {
  /** Keeps the report current until unsubscribed, scanning first only if no report exists yet. */
  abstract keepReportCurrent$(userId: UserId): Observable<void>;

  /** Requests another full scan. Only `userId`'s subscribed scan reacts. */
  abstract retryScan(userId: UserId): void;

  /** True when fetching the ciphers failed, which cannot surface as a report `error` status. */
  abstract pipelineFailed$(userId: UserId): Observable<boolean>;
}
