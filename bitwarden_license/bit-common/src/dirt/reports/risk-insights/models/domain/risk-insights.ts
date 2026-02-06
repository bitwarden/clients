import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import Domain from "@bitwarden/common/platform/models/domain/domain-base";
import { conditionalEncString } from "@bitwarden/common/vault/utils/domain-utils";

import { RiskInsightsData } from "../data/risk-insights.data";

export class RiskInsights extends Domain {
  id: string = "";
  organizationId: string = "";
  reports: EncString = new EncString("");
  applications: EncString = new EncString("");
  summary: EncString = new EncString("");
  creationDate: Date;
  contentEncryptionKey?: EncString;

  constructor(obj?: RiskInsightsData) {
    super();
    if (obj == null) {
      this.creationDate = new Date();
      return;
    }
    this.id = obj.id;
    this.organizationId = obj.organizationId;
    this.reports = conditionalEncString(obj.reports);
    this.applications = conditionalEncString(obj.applications);
    this.summary = conditionalEncString(obj.summary);
    this.creationDate = new Date(obj.creationDate);
    this.contentEncryptionKey = conditionalEncString(obj.contentEncryptionKey);

    // Example usage when individual keys are encrypted instead of the entire object
    // this.summary = new RiskInsightsSummary(obj.summary);

    // if (obj.reports != null) {
    //   this.reports = obj.reports.map((r) => new RiskInsightsReport(r));
    // }
    // if (obj.applications != null) {
    //   this.applications = obj.applications.map((a) => new RiskInsightsApplication(a));
    // }
  }

  // [TODO] Domain level methods
  // static fromJSON(obj: Jsonify<RiskInsights>): RiskInsights {}
  // decrypt() RiskInsightsView {}
  // toData(): RiskInsightsData {}

  // [TODO] SDK Mapping
  // toSdkRiskInsights(): SdkRiskInsights {}
  // static fromSdkRiskInsights(obj?: SdkRiskInsights): RiskInsights | undefined {}
}
