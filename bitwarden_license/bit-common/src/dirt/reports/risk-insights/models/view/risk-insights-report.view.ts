import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportApi } from "../api/risk-insights-report.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportData } from "../data/risk-insights-report.data";
import { RiskInsightsReport } from "../domain/risk-insights-report";

import { MemberRegistry, MemberRegistryEntry } from "./risk-insights.view";

/**
 * View model for Risk Insights Report containing decrypted application health data
 *
 * Uses the member registry pattern to eliminate duplicate member storage across applications.
 * Instead of storing full member arrays, stores only member IDs with at-risk flags.
 *
 * - See {@link RiskInsightsReport} for domain model
 * - See {@link RiskInsightsReportData} for data model
 * - See {@link RiskInsightsReportApi} for API model
 */
export class RiskInsightsReportView implements View {
  applicationName: string = "";
  passwordCount: number = 0;
  atRiskPasswordCount: number = 0;

  /**
   * Member references with at-risk status
   *
   * Record<OrganizationUserId, boolean> where:
   * - Key: member ID (userGuid)
   * - Value: true if at-risk, false if not at-risk
   *
   * Replaces: memberDetails[] + atRiskMemberDetails[]
   */
  memberRefs: Record<string, boolean> = {};

  /**
   * Cipher references with at-risk status
   *
   * Record<CipherId, boolean> where:
   * - Key: cipher ID
   * - Value: true if at-risk, false if not at-risk
   *
   * Replaces: cipherIds[] + atRiskCipherIds[]
   */
  cipherRefs: Record<string, boolean> = {};

  // Computed counts (redundant but kept for backward compatibility)
  memberCount: number = 0;
  atRiskMemberCount: number = 0;

  constructor(r?: RiskInsightsReport) {
    if (r == null) {
      return;
    }
  }

  /**
   * Get all members for this application
   *
   * @param registry - The member registry containing full member details
   * @returns Array of member entries
   */
  getAllMembers(registry: MemberRegistry): MemberRegistryEntry[] {
    return Object.keys(this.memberRefs)
      .map((id) => registry[id])
      .filter((entry): entry is MemberRegistryEntry => entry !== undefined);
  }

  /**
   * Get only at-risk members for this application
   *
   * @param registry - The member registry containing full member details
   * @returns Array of at-risk member entries
   */
  getAtRiskMembers(registry: MemberRegistry): MemberRegistryEntry[] {
    return Object.entries(this.memberRefs)
      .filter(([_, isAtRisk]) => isAtRisk)
      .map(([id]) => registry[id])
      .filter((entry): entry is MemberRegistryEntry => entry !== undefined);
  }

  /**
   * Check if this application has any at-risk passwords
   *
   * @returns True if application has at-risk passwords
   */
  isAtRisk(): boolean {
    return this.atRiskPasswordCount > 0;
  }

  /**
   * Check if a specific member has access to this application
   *
   * @param memberId - Organization user ID
   * @returns True if member has access
   */
  hasMember(memberId: string): boolean {
    return memberId in this.memberRefs;
  }

  /**
   * Check if a specific member is at-risk for this application
   *
   * @param memberId - Organization user ID
   * @returns True if member is at-risk
   */
  isMemberAtRisk(memberId: string): boolean {
    return this.memberRefs[memberId] === true;
  }

  /**
   * Get all cipher IDs for this application
   *
   * @returns Array of cipher IDs
   */
  getAllCipherIds(): string[] {
    return Object.keys(this.cipherRefs);
  }

  /**
   * Get only at-risk cipher IDs for this application
   *
   * @returns Array of at-risk cipher IDs
   */
  getAtRiskCipherIds(): string[] {
    return Object.entries(this.cipherRefs)
      .filter(([_, isAtRisk]) => isAtRisk)
      .map(([id]) => id);
  }

  toJSON() {
    return this;
  }

  static fromJSON(
    obj: Partial<DeepJsonify<RiskInsightsReportView>> | undefined,
  ): RiskInsightsReportView {
    if (obj == undefined) {
      return new RiskInsightsReportView();
    }

    const view = Object.assign(new RiskInsightsReportView(), obj) as RiskInsightsReportView;

    // Ensure memberRefs and cipherRefs are objects (not arrays)
    view.memberRefs = obj.memberRefs ?? {};
    view.cipherRefs = obj.cipherRefs ?? {};

    return view;
  }

  // [TODO] SDK Mapping
  // toSdkRiskInsightsReportView(): SdkRiskInsightsReportView {}
  // static fromRiskInsightsReportView(obj?: SdkRiskInsightsReportView): RiskInsightsReportView | undefined {}
}
