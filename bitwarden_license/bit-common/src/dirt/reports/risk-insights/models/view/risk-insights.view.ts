import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsApi } from "../api/risk-insights.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsData } from "../data/risk-insights.data";
import { RiskInsights } from "../domain/risk-insights";

import { RiskInsightsApplicationView } from "./risk-insights-application.view";
import { RiskInsightsReportView } from "./risk-insights-report.view";
import { RiskInsightsSummaryView } from "./risk-insights-summary.view";

/**
 * Member registry entry
 *
 * Represents a single organization member in the deduplicated member registry.
 * Members are stored once in the registry and referenced by ID from applications.
 */
export interface MemberRegistryEntry {
  /** Organization user ID (userGuid from OrganizationUserView) */
  id: string;
  /** Display name of the member */
  userName: string;
  /** Email address of the member */
  email: string;
}

/**
 * Member Registry - Deduplicated member lookup table
 *
 * A simple Record mapping organization user ID to member entry.
 * Applications store only member IDs (as Record<string, boolean>) which are
 * resolved to full entries via this registry.
 *
 * **Performance Impact:**
 * - Without registry: 5,000 members × 50 apps × 180 bytes = ~45MB (duplicated)
 * - With registry: 5,000 members × 140 bytes = ~700KB (deduplicated)
 * - **Savings: ~98% reduction in member data storage**
 */
export type MemberRegistry = Record<string, MemberRegistryEntry>;

/**
 * View model for Risk Insights containing decrypted properties
 *
 * Uses the member registry pattern to eliminate duplicate member storage across applications.
 * The registry is shared across all application reports and provides O(1) member lookup.
 *
 * - See {@link RiskInsights} for domain model
 * - See {@link RiskInsightsData} for data model
 * - See {@link RiskInsightsApi} for API model
 */
export class RiskInsightsView implements View {
  id: OrganizationReportId = "" as OrganizationReportId;
  organizationId: OrganizationId = "" as OrganizationId;
  reports: RiskInsightsReportView[] = [];
  applications: RiskInsightsApplicationView[] = [];
  summary = new RiskInsightsSummaryView();
  memberRegistry: MemberRegistry = {};
  creationDate: Date;
  contentEncryptionKey?: EncString;

  constructor(report?: RiskInsights) {
    if (!report) {
      this.creationDate = new Date();
      return;
    }

    this.id = report.id as OrganizationReportId;
    this.organizationId = report.organizationId as OrganizationId;
    this.creationDate = report.creationDate;
    this.contentEncryptionKey = report.contentEncryptionKey;
  }

  toJSON() {
    return this;
  }

  static fromJSON(obj: Partial<DeepJsonify<RiskInsightsView>> | null): RiskInsightsView {
    if (obj == undefined) {
      return new RiskInsightsView();
    }

    const view = Object.assign(new RiskInsightsView(), obj) as RiskInsightsView;

    view.reports = obj.reports?.map((report) => RiskInsightsReportView.fromJSON(report)) ?? [];
    view.applications = obj.applications?.map((a) => RiskInsightsApplicationView.fromJSON(a)) ?? [];
    view.summary = RiskInsightsSummaryView.fromJSON(obj.summary ?? {});
    view.memberRegistry = obj.memberRegistry ?? {};

    return view;
  }

  // [TODO] SDK Mapping
  // toSdkRiskInsightsView(): SdkRiskInsightsView {}
  // static fromRiskInsightsView(obj?: SdkRiskInsightsView): RiskInsightsView | undefined {}
}
