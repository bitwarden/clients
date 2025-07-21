import { from, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { EncryptedDataModel } from "../models/password-health";

export class RiskInsightsApiService {
  constructor(private apiService: ApiService) {}

  getRiskInsightsSummary(
    orgId: string,
    minDate: Date,
    maxDate: Date,
  ): Observable<EncryptedDataModel[]> {
    const minDateStr = minDate.toISOString().split("T")[0];
    const maxDateStr = maxDate.toISOString().split("T")[0];
    const dbResponse = this.apiService.send(
      "GET",
      `organization-report-summary/${orgId.toString()}?from=${minDateStr}&to=${maxDateStr}`,
      null,
      true,
      true,
    );

    return from(dbResponse as Promise<EncryptedDataModel[]>);
  }

  saveRiskInsightsSummary(data: EncryptedDataModel): Observable<void> {
    const dbResponse = this.apiService.send(
      "POST",
      "organization-report-summary",
      data,
      true,
      true,
    );

    return from(dbResponse as Promise<void>);
  }

  updateRiskInsightsSummary(data: EncryptedDataModel): Observable<void> {
    const dbResponse = this.apiService.send("PUT", "organization-report-summary", data, true, true);

    return from(dbResponse as Promise<void>);
  }
}
