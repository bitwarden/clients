import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  ApplicationHealthReportDetail,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "./report-models";

export type ApplicationHealthReportDetailEnriched = ApplicationHealthReportDetail & {
  isMarkedAsCritical: boolean;
  ciphers: CipherView[];
};
export interface RiskInsightsEnrichedData {
  reportData: ApplicationHealthReportDetailEnriched[];
  summaryData: OrganizationReportSummary;
  applicationData: OrganizationReportApplication[];
  creationDate: Date;
}
