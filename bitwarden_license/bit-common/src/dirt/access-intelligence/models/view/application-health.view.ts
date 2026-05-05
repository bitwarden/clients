import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ApplicationHealthApi } from "../api/application-health.api";
import { ApplicationHealthData } from "../data/application-health.data";
import { ApplicationHealth } from "../domain/application-health";

import { MemberRegistry } from "./access-report.view";
import { MemberRegistryEntryView } from "./member-registry-entry.view";

/**
 * View model for Application Health containing decrypted application health data
 *
 * Uses the member registry pattern to eliminate duplicate member storage across applications.
 * Instead of storing full member arrays, stores only member IDs with at-risk flags.
 *
 * - See {@link ApplicationHealth} for domain model
 * - See {@link ApplicationHealthData} for data model
 * - See {@link ApplicationHealthApi} for API model
 */
export class ApplicationHealthView implements View {
  applicationName: string = "";
  passwordCount: number = 0;
  atRiskPasswordCount: number = 0;

  /**
   * Icon metadata for display purposes
   *
   * Pre-computed during report generation to avoid runtime lookups.
   * Contains the URI/hostname and cipher ID of the first cipher for icon display.
   */
  iconUri?: string;
  iconCipherId?: string;

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

  constructor(r?: ApplicationHealth) {
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
  getAllMembers(registry: MemberRegistry): MemberRegistryEntryView[] {
    return Object.keys(this.memberRefs)
      .map((id) => registry[id])
      .filter((entry): entry is MemberRegistryEntryView => entry !== undefined);
  }

  /**
   * Get only at-risk members for this application
   *
   * @param registry - The member registry containing full member details
   * @returns Array of at-risk member entries
   */
  getAtRiskMembers(registry: MemberRegistry): MemberRegistryEntryView[] {
    return Object.entries(this.memberRefs)
      .filter(([_, isAtRisk]) => isAtRisk)
      .map(([id]) => registry[id])
      .filter((entry): entry is MemberRegistryEntryView => entry !== undefined);
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

  /**
   * Get the cipher ID to use for icon display
   *
   * Returns the pre-computed icon cipher ID if available,
   * otherwise returns the first cipher ID from cipherRefs.
   *
   * @returns Cipher ID for icon display, or undefined if no ciphers
   */
  getIconCipherId(): string | undefined {
    if (this.iconCipherId) {
      return this.iconCipherId;
    }

    const cipherIds = this.getAllCipherIds();
    return cipherIds.length > 0 ? cipherIds[0] : undefined;
  }

  toJSON() {
    return this;
  }

  static fromData(data: ApplicationHealthData): ApplicationHealthView {
    const view = new ApplicationHealthView();
    view.applicationName = data.applicationName;
    view.passwordCount = data.passwordCount;
    view.atRiskPasswordCount = data.atRiskPasswordCount;
    view.memberRefs = { ...data.memberRefs };
    view.cipherRefs = { ...data.cipherRefs };
    view.memberCount = data.memberCount;
    view.atRiskMemberCount = data.atRiskMemberCount;
    view.iconUri = data.iconUri;
    view.iconCipherId = data.iconCipherId;
    return view;
  }

  static fromJSON(
    obj: Partial<DeepJsonify<ApplicationHealthView>> | undefined,
  ): ApplicationHealthView {
    if (obj == undefined) {
      return new ApplicationHealthView();
    }

    const view = Object.assign(new ApplicationHealthView(), obj) as ApplicationHealthView;

    // Ensure memberRefs and cipherRefs are objects (not arrays)
    view.memberRefs = obj.memberRefs ?? {};
    view.cipherRefs = obj.cipherRefs ?? {};

    return view;
  }

  // [TODO] SDK Mapping
  // toSdkApplicationHealthView(): SdkApplicationHealthView {}
  // static fromApplicationHealthView(obj?: SdkApplicationHealthView): ApplicationHealthView | undefined {}
}
