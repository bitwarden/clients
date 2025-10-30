import {
  ApplicationHealthReportDetail,
  MemberDetails,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "../../models";

import {
  createBoundedArrayGuard,
  createValidator,
  isBoolean,
  isBoundedString,
  isBoundedStringArray,
  isBoundedStringOrNull,
  isBoundedPositiveNumber,
  BOUNDED_ARRAY_MAX_LENGTH,
  isDate,
  isDateString,
} from "./basic-type-guards";

// Risk Insights specific type guards

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
 * Type guard to validate ApplicationHealthReportDetail structure
 * Exported for testability
 * Strict validation: rejects objects with unexpected properties and prototype pollution
 */
export const isApplicationHealthReportDetail = createValidator<ApplicationHealthReportDetail>({
  applicationName: isBoundedString,
  atRiskCipherIds: isBoundedStringArray,
  atRiskMemberCount: isBoundedPositiveNumber,
  atRiskMemberDetails: isMemberDetailsArray,
  atRiskPasswordCount: isBoundedPositiveNumber,
  cipherIds: isBoundedStringArray,
  memberCount: isBoundedPositiveNumber,
  memberDetails: isMemberDetailsArray,
  passwordCount: isBoundedPositiveNumber,
});
export const isApplicationHealthReportDetailArray = createBoundedArrayGuard(
  isApplicationHealthReportDetail,
);

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
    const invalidIndices = invalidItems.map(({ index }) => index).join(", ");
    throw new Error(
      `Invalid report data: array contains ${invalidItems.length} invalid ApplicationHealthReportDetail element(s) at indices: ${invalidIndices}`,
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
    const invalidIndices = invalidItems.map(({ index }) => index).join(", ");
    throw new Error(
      `Invalid application data: array contains ${invalidItems.length} invalid OrganizationReportApplication element(s) at indices: ${invalidIndices}`,
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

  if (!isOrganizationReportApplicationArray(data)) {
    // Throw for type casting return
    // Should never get here
    throw new Error("Invalid application data");
  }

  // Convert string dates to Date objects for reviewedDate
  return mappedData;
}
