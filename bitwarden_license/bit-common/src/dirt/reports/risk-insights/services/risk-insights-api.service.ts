import { Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  GetRiskInsightsReportResponse,
  SaveRiskInsightsReportRequest,
  SaveRiskInsightsReportResponse,
} from "../models/password-health";

export class RiskInsightsApiService {
  constructor(private apiService: ApiService) {}

  // [FIX-ME] This method is not implemented yet.
  saveRiskInsightsReport(
    request: SaveRiskInsightsReportRequest,
  ): Observable<SaveRiskInsightsReportResponse> {
    return;
  }

  // [FIX-ME] This method is not implemented yet.
  getRiskInsightsReport(orgId: OrganizationId): Observable<GetRiskInsightsReportResponse | null> {
    return;
  }
}
