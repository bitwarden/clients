import { CipherId } from "@bitwarden/common/types/guid";

import {
  ApplicationHealthReportDetail,
  MemberDetails,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "../../models";
import { RiskInsightsApplicationData } from "../../models/data/risk-insights-application.data";
import {
  MemberRegistryEntryData,
  RiskInsightsReportData,
} from "../../models/data/risk-insights-report.data";
import { RiskInsightsSummaryData } from "../../models/data/risk-insights-summary.data";
import { AccessReportPayload } from "../../services/abstractions/access-report-encryption.service";

import {
  createBoundedArrayGuard,
  createValidator,
  isBoolean,
  isBooleanRecord,
  isBoundedString,
  isBoundedStringOrNull,
  isBoundedStringOrUndefined,
  isBoundedPositiveNumber,
  BOUNDED_ARRAY_MAX_LENGTH,
  isDate,
  isDateString,
  isDateStringOrUndefined,
} from "./basic-type-guards";

// === Type Guards for Access Intelligence ===

/**
 * Type guard to validate MemberDetails structure
 * Exported for testability
 * Strict validation: rejects objects with unexpected properties and prototype pollution
 */
export const isMemberDetails = createValidator<MemberDetails>({
  userGuid: isBoundedString,
  userName: isBoundedStringOrNull,
  email: isBoundedString,
  cipherId: isBoundedString,
});
export const isMemberDetailsArray = createBoundedArrayGuard(isMemberDetails);

/**
 * Type guard to validate MemberRegistryEntryData structure
 * Exported for testability
 * Strict validation: rejects objects with unexpected properties and prototype pollution
 */
export const isMemberRegistryEntryData = createValidator<MemberRegistryEntryData>({
  id: isBoundedString,
  userName: isBoundedString,
  email: isBoundedString,
});

export function isCipherId(value: unknown): value is CipherId {
  return value == null || isBoundedString(value);
}
export const isCipherIdArray = createBoundedArrayGuard(isCipherId);

/**
 * Type guard to validate ApplicationHealthReportDetail structure
 * Exported for testability
 * Strict validation: rejects objects with unexpected properties and prototype pollution
 */
export const isApplicationHealthReportDetail = createValidator<ApplicationHealthReportDetail>({
  applicationName: isBoundedString,
  atRiskCipherIds: isCipherIdArray,
  atRiskMemberCount: isBoundedPositiveNumber,
  atRiskMemberDetails: isMemberDetailsArray,
  atRiskPasswordCount: isBoundedPositiveNumber,
  cipherIds: isCipherIdArray,
  memberCount: isBoundedPositiveNumber,
  memberDetails: isMemberDetailsArray,
  passwordCount: isBoundedPositiveNumber,
});
export const isApplicationHealthReportDetailArray = createBoundedArrayGuard(
  isApplicationHealthReportDetail,
);

const isRiskInsightsReportDataV2Entry = createValidator<RiskInsightsReportData>({
  applicationName: isBoundedString,
  passwordCount: isBoundedPositiveNumber,
  atRiskPasswordCount: isBoundedPositiveNumber,
  memberRefs: isBooleanRecord,
  cipherRefs: isBooleanRecord,
  memberCount: isBoundedPositiveNumber,
  atRiskMemberCount: isBoundedPositiveNumber,
  iconUri: isBoundedStringOrUndefined,
  iconCipherId: isBoundedStringOrUndefined,
});
const isRiskInsightsReportDataV2Array = createBoundedArrayGuard(isRiskInsightsReportDataV2Entry);

/**
 * Type guard to validate OrganizationReportSummary structure
 * Exported for testability
 * Strict validation: rejects objects with unexpected properties and prototype pollution
 */
export const isOrganizationReportSummary = createValidator<OrganizationReportSummary>({
  totalMemberCount: isBoundedPositiveNumber,
  totalApplicationCount: isBoundedPositiveNumber,
  totalAtRiskMemberCount: isBoundedPositiveNumber,
  totalAtRiskApplicationCount: isBoundedPositiveNumber,
  totalCriticalApplicationCount: isBoundedPositiveNumber,
  totalCriticalMemberCount: isBoundedPositiveNumber,
  totalCriticalAtRiskMemberCount: isBoundedPositiveNumber,
  totalCriticalAtRiskApplicationCount: isBoundedPositiveNumber,
});

// Adding to support reviewedDate casting for mapping until the date is saved as a string
function isValidDateOrNull(value: unknown): value is Date | null {
  return value == null || isDate(value) || isDateString(value);
}

/**
 * Type guard to validate OrganizationReportApplication structure
 * Exported for testability
 * Strict validation: rejects objects with unexpected properties and prototype pollution
 */
export const isOrganizationReportApplication = createValidator<OrganizationReportApplication>({
  applicationName: isBoundedString,
  isCritical: isBoolean,
  // ReviewedDate is currently being saved to the database as a Date type
  // We can improve this when OrganizationReportApplication is updated
  // to use the Domain, Api, and View model pattern to convert the type to a string
  // for storage instead of Date
  // Should eventually be changed to isDateStringOrNull
  reviewedDate: isValidDateOrNull,
});
export const isOrganizationReportApplicationArray = createBoundedArrayGuard(
  isOrganizationReportApplication,
);

// === Validate Functions ===

/**
 * Validates and returns an array of ApplicationHealthReportDetail
 * @throws Error if validation fails
 */
export function validateApplicationHealthReportDetailArray(
  data: unknown,
): ApplicationHealthReportDetail[] {
  if (!Array.isArray(data)) {
    throw new Error(
      "Invalid report data: expected array of ApplicationHealthReportDetail, received non-array",
    );
  }

  if (data.length > BOUNDED_ARRAY_MAX_LENGTH) {
    throw new Error(
      `Invalid report data: array length ${data.length} exceeds maximum allowed length ${BOUNDED_ARRAY_MAX_LENGTH}`,
    );
  }

  const invalidItems = data
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !isApplicationHealthReportDetail(item));

  if (invalidItems.length > 0) {
    const elementMessages = invalidItems.map(({ item, index }) => {
      const fieldErrors = isApplicationHealthReportDetail.explain(item).join("; ");
      return `  element[${index}]: ${fieldErrors}`;
    });
    throw new Error(
      `Invalid report data: array contains ${invalidItems.length} invalid ApplicationHealthReportDetail element(s)\n` +
        elementMessages.join("\n"),
    );
  }

  if (!isApplicationHealthReportDetailArray(data)) {
    // Throw for type casting return
    // Should never get here
    throw new Error("Invalid report data");
  }

  return data;
}

/**
 * Validates and returns OrganizationReportSummary
 * @throws Error if validation fails
 */
export function validateOrganizationReportSummary(data: unknown): OrganizationReportSummary {
  if (!isOrganizationReportSummary(data)) {
    throw new Error("Invalid report summary");
  }

  return data;
}

/**
 * Validates and returns RiskInsightsSummaryData
 * @throws Error if validation fails
 */
export function validateRiskInsightsSummaryData(data: unknown): RiskInsightsSummaryData {
  if (!isOrganizationReportSummary(data)) {
    throw new Error("Invalid report summary");
  }
  return data as unknown as RiskInsightsSummaryData;
}

/**
 * Validates and returns an array of OrganizationReportApplication
 * @throws Error if validation fails
 */
export function validateOrganizationReportApplicationArray(
  data: unknown,
): OrganizationReportApplication[] {
  if (!Array.isArray(data)) {
    throw new Error(
      "Invalid application data: expected array of OrganizationReportApplication, received non-array",
    );
  }

  if (data.length > BOUNDED_ARRAY_MAX_LENGTH) {
    throw new Error(
      `Invalid application data: array length ${data.length} exceeds maximum allowed length ${BOUNDED_ARRAY_MAX_LENGTH}`,
    );
  }

  const invalidItems = data
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !isOrganizationReportApplication(item));

  if (invalidItems.length > 0) {
    const elementMessages = invalidItems.map(({ item, index }) => {
      const fieldErrors = isOrganizationReportApplication.explain(item).join("; ");
      return `  element[${index}]: ${fieldErrors}`;
    });
    throw new Error(
      `Invalid application data: array contains ${invalidItems.length} invalid OrganizationReportApplication element(s)\n` +
        elementMessages.join("\n"),
    );
  }

  const mappedData = data.map((item) => ({
    ...item,
    reviewedDate: item.reviewedDate
      ? item.reviewedDate instanceof Date
        ? item.reviewedDate
        : (() => {
            const date = new Date(item.reviewedDate);
            if (!isDate(date)) {
              throw new Error(`Invalid date string: ${item.reviewedDate}`);
            }
            return date;
          })()
      : null,
  }));

  if (!isOrganizationReportApplicationArray(mappedData)) {
    // Throw for type casting return
    // Should never get here
    throw new Error("Invalid application data");
  }

  // Convert string dates to Date objects for reviewedDate
  return mappedData;
}

const isRiskInsightsApplicationData = createValidator<RiskInsightsApplicationData>({
  applicationName: isBoundedString,
  isCritical: isBoolean,
  reviewedDate: isDateStringOrUndefined,
});
const isRiskInsightsApplicationDataArray = createBoundedArrayGuard(isRiskInsightsApplicationData);

/**
 * Validates and returns an array of RiskInsightsApplicationData
 * @throws Error if validation fails
 */
export function validateRiskInsightsApplicationDataArray(
  data: unknown,
): RiskInsightsApplicationData[] {
  if (!Array.isArray(data)) {
    throw new Error(
      "Invalid application data: expected array of RiskInsightsApplicationData, received non-array",
    );
  }

  if (data.length > BOUNDED_ARRAY_MAX_LENGTH) {
    throw new Error(
      `Invalid application data: array length ${data.length} exceeds maximum allowed length ${BOUNDED_ARRAY_MAX_LENGTH}`,
    );
  }

  const invalidItems = data
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !isRiskInsightsApplicationData(item));

  if (invalidItems.length > 0) {
    const elementMessages = invalidItems.map(({ item, index }) => {
      const fieldErrors = isRiskInsightsApplicationData.explain(item).join("; ");
      return `  element[${index}]: ${fieldErrors}`;
    });
    throw new Error(
      `Invalid application data: array contains ${invalidItems.length} invalid RiskInsightsApplicationData element(s)\n` +
        elementMessages.join("\n"),
    );
  }

  if (!isRiskInsightsApplicationDataArray(data)) {
    // Throw for type casting return
    // Should never get here
    throw new Error("Invalid application data");
  }

  return data;
}

/**
 * Validates and returns AccessReportPayload
 * @throws Error if validation fails
 */
export function validateAccessReportPayload(data: unknown): AccessReportPayload {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid V2 report data: expected a versioned object, received non-object");
  }

  const obj = data as Record<string, unknown>;

  if (obj["version"] !== 2) {
    throw new Error(
      `Invalid V2 report data: expected version 2, received version ${obj["version"]}`,
    );
  }

  if (!isRiskInsightsReportDataV2Array(obj["reports"])) {
    throw new Error("Invalid V2 report data: reports array failed validation");
  }

  if (
    obj["memberRegistry"] == null ||
    typeof obj["memberRegistry"] !== "object" ||
    Array.isArray(obj["memberRegistry"])
  ) {
    throw new Error("Invalid V2 report data: memberRegistry is not an object");
  }

  const registry = obj["memberRegistry"] as Record<string, unknown>;
  const registryEntries = Object.entries(registry);
  if (registryEntries.length > BOUNDED_ARRAY_MAX_LENGTH) {
    throw new Error(
      `Invalid V2 report data: memberRegistry length ${registryEntries.length} exceeds maximum`,
    );
  }
  for (const [key, entry] of registryEntries) {
    if (!isBoundedString(key) || !isMemberRegistryEntryData(entry)) {
      const fieldErrors = isMemberRegistryEntryData.explain(entry).join("; ");
      throw new Error(
        `Invalid V2 report data: invalid memberRegistry entry for key "${key}": ${fieldErrors}`,
      );
    }
  }

  return data as AccessReportPayload;
}
