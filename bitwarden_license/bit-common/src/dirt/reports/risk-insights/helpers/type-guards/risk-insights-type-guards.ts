import { CipherId } from "@bitwarden/common/types/guid";

import {
  MemberRegistryEntryData,
  AccessReportSettingsData,
  ApplicationHealthData,
  AccessReportSummaryData,
} from "../../../../access-intelligence/models";
import { AccessReportPayload } from "../../../../access-intelligence/services";
import {
  ApplicationHealthReportDetail,
  MemberDetails,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "../../models";

import {
  createBoundedArrayGuard,
  createBoundedRecordGuard,
  createEnhancedBoundedArrayGuard,
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
  cipherId: isBoundedString, // TODO is isBoundedStringOrNull for backwards compatibility
});
export const isMemberDetailsArray = createEnhancedBoundedArrayGuard(isMemberDetails);

/**
 * Type guard to validate MemberRegistryEntryData structure
 * Exported for testability
 * Strict validation: rejects objects with unexpected properties and prototype pollution
 */
export const isMemberRegistryEntryData = createValidator<MemberRegistryEntryData>({
  id: isBoundedString,
  userName: isBoundedStringOrUndefined,
  email: isBoundedString,
});
const isMemberRegistry = createBoundedRecordGuard(isMemberRegistryEntryData);

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

const isApplicationHealthData = createValidator<ApplicationHealthData>({
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
const isApplicationHealthDataArray = createBoundedArrayGuard(isApplicationHealthData);

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

export const isAccessReportSummaryData = createValidator<AccessReportSummaryData>({
  totalMemberCount: isBoundedPositiveNumber,
  totalApplicationCount: isBoundedPositiveNumber,
  totalAtRiskMemberCount: isBoundedPositiveNumber,
  totalAtRiskApplicationCount: isBoundedPositiveNumber,
  totalCriticalApplicationCount: isBoundedPositiveNumber,
  totalCriticalMemberCount: isBoundedPositiveNumber,
  totalCriticalAtRiskMemberCount: isBoundedPositiveNumber,
  totalCriticalAtRiskApplicationCount: isBoundedPositiveNumber,
});

/**
 * Validates and returns AccessReportSummaryData
 * @throws Error if validation fails
 */
export function validateAccessReportSummaryData(data: unknown): AccessReportSummaryData {
  if (!isAccessReportSummaryData(data)) {
    throw new Error("Invalid report summary");
  }
  return data;
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

const isAccessReportSettingsData = createValidator<AccessReportSettingsData>({
  applicationName: isBoundedString,
  isCritical: isBoolean,
  reviewedDate: isDateStringOrUndefined,
});
export const isAccessReportSettingsDataArray = createBoundedArrayGuard(isAccessReportSettingsData);

/**
 * Validates and returns an array of AccessReportSettingsData
 * @throws Error if validation fails
 */
export function validateAccessReportSettingsDataArray(data: unknown): AccessReportSettingsData[] {
  if (!Array.isArray(data)) {
    throw new Error(
      "Invalid application data: expected array of AccessReportSettingsData, received non-array",
    );
  }

  if (data.length > BOUNDED_ARRAY_MAX_LENGTH) {
    throw new Error(
      `Invalid application data: array length ${data.length} exceeds maximum allowed length ${BOUNDED_ARRAY_MAX_LENGTH}`,
    );
  }

  const invalidItems = data
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !isAccessReportSettingsData(item));

  if (invalidItems.length > 0) {
    const elementMessages = invalidItems.map(({ item, index }) => {
      const fieldErrors = isAccessReportSettingsData.explain(item).join("; ");
      return `  element[${index}]: ${fieldErrors}`;
    });
    throw new Error(
      `Invalid application data: array contains ${invalidItems.length} invalid AccessReportSettingsData element(s)\n` +
        elementMessages.join("\n"),
    );
  }

  if (!isAccessReportSettingsDataArray(data)) {
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
    throw new Error("Invalid report payload: expected object, received non-object");
  }

  const obj = data as Record<string, unknown>;

  if (!isApplicationHealthDataArray(obj["reports"])) {
    throw new Error("Invalid report payload: reports array failed validation");
  }

  // Pre-normalize "" → undefined before validation for backwards compatibility with
  // blobs that stored empty string. The guard uses isBoundedStringOrUndefined which
  // rejects "", so normalization must happen before the guard runs.
  if (typeof obj["memberRegistry"] === "object" && obj["memberRegistry"] !== null) {
    for (const entry of Object.values(obj["memberRegistry"] as Record<string, unknown>)) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        (entry as Record<string, unknown>)["userName"] === ""
      ) {
        (entry as Record<string, unknown>)["userName"] = undefined;
      }
    }
  }

  if (!isMemberRegistry(obj["memberRegistry"])) {
    const errors = isMemberRegistry.explain(obj["memberRegistry"]).join("; ");
    throw new Error(`Invalid report payload: memberRegistry failed validation: ${errors}`);
  }

  return data as AccessReportPayload;
}
