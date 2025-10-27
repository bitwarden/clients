import {
  ApplicationHealthReportDetail,
  MemberDetails,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "../../models";

/**
 * Type guard to validate MemberDetails structure
 * Exported for testability
 * Strict validation: rejects objects with unexpected properties and prototype pollution
 */
export function isMemberDetails(obj: any): obj is MemberDetails {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  // Prevent prototype pollution - check prototype is Object.prototype
  if (Object.getPrototypeOf(obj) !== Object.prototype) {
    return false;
  }

  // Prevent dangerous own properties
  if (
    Object.prototype.hasOwnProperty.call(obj, "constructor") ||
    Object.prototype.hasOwnProperty.call(obj, "prototype")
  ) {
    return false;
  }

  // Strict property validation - reject unexpected properties
  const allowedKeys = ["userGuid", "userName", "email", "cipherId"];
  const actualKeys = Object.keys(obj);
  const hasUnexpectedProps = actualKeys.some((key) => !allowedKeys.includes(key));
  if (hasUnexpectedProps) {
    return false;
  }

  return (
    typeof obj.userGuid === "string" &&
    obj.userGuid.length > 0 &&
    typeof obj.userName === "string" &&
    obj.userName.length > 0 &&
    typeof obj.email === "string" &&
    obj.email.length > 0 &&
    typeof obj.cipherId === "string" &&
    obj.cipherId.length > 0
  );
}

/**
 * Type guard to validate ApplicationHealthReportDetail structure
 * Exported for testability
 * Strict validation: rejects objects with unexpected properties and prototype pollution
 */
export function isApplicationHealthReportDetail(obj: any): obj is ApplicationHealthReportDetail {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  // Prevent prototype pollution - check prototype is Object.prototype
  if (Object.getPrototypeOf(obj) !== Object.prototype) {
    return false;
  }

  // Prevent dangerous own properties
  if (
    Object.prototype.hasOwnProperty.call(obj, "constructor") ||
    Object.prototype.hasOwnProperty.call(obj, "prototype")
  ) {
    return false;
  }

  // Strict property validation - reject unexpected properties
  const allowedKeys = [
    "applicationName",
    "passwordCount",
    "atRiskPasswordCount",
    "atRiskCipherIds",
    "memberCount",
    "atRiskMemberCount",
    "memberDetails",
    "atRiskMemberDetails",
    "cipherIds",
  ];
  const actualKeys = Object.keys(obj);
  const hasUnexpectedProps = actualKeys.some((key) => !allowedKeys.includes(key));
  if (hasUnexpectedProps) {
    return false;
  }

  return (
    typeof obj.applicationName === "string" &&
    obj.applicationName.length > 0 &&
    typeof obj.passwordCount === "number" &&
    Number.isFinite(obj.passwordCount) &&
    obj.passwordCount >= 0 &&
    typeof obj.atRiskPasswordCount === "number" &&
    Number.isFinite(obj.atRiskPasswordCount) &&
    obj.atRiskPasswordCount >= 0 &&
    Array.isArray(obj.atRiskCipherIds) &&
    obj.atRiskCipherIds.every((id: any) => typeof id === "string" && id.length > 0) &&
    typeof obj.memberCount === "number" &&
    Number.isFinite(obj.memberCount) &&
    obj.memberCount >= 0 &&
    typeof obj.atRiskMemberCount === "number" &&
    Number.isFinite(obj.atRiskMemberCount) &&
    obj.atRiskMemberCount >= 0 &&
    Array.isArray(obj.memberDetails) &&
    obj.memberDetails.every(isMemberDetails) &&
    Array.isArray(obj.atRiskMemberDetails) &&
    obj.atRiskMemberDetails.every(isMemberDetails) &&
    Array.isArray(obj.cipherIds) &&
    obj.cipherIds.every((id: any) => typeof id === "string" && id.length > 0)
  );
}

/**
 * Type guard to validate OrganizationReportSummary structure
 * Exported for testability
 * Strict validation: rejects objects with unexpected properties and prototype pollution
 */
export function isOrganizationReportSummary(obj: any): obj is OrganizationReportSummary {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  // Prevent prototype pollution - check prototype is Object.prototype
  if (Object.getPrototypeOf(obj) !== Object.prototype) {
    return false;
  }

  // Prevent dangerous own properties
  if (
    Object.prototype.hasOwnProperty.call(obj, "constructor") ||
    Object.prototype.hasOwnProperty.call(obj, "prototype")
  ) {
    return false;
  }

  // Strict property validation - reject unexpected properties
  const allowedKeys = [
    "totalMemberCount",
    "totalApplicationCount",
    "totalAtRiskMemberCount",
    "totalAtRiskApplicationCount",
    "totalCriticalApplicationCount",
    "totalCriticalMemberCount",
    "totalCriticalAtRiskMemberCount",
    "totalCriticalAtRiskApplicationCount",
    "newApplications",
  ];
  const actualKeys = Object.keys(obj);
  const hasUnexpectedProps = actualKeys.some((key) => !allowedKeys.includes(key));
  if (hasUnexpectedProps) {
    return false;
  }

  return (
    typeof obj.totalMemberCount === "number" &&
    Number.isFinite(obj.totalMemberCount) &&
    obj.totalMemberCount >= 0 &&
    typeof obj.totalApplicationCount === "number" &&
    Number.isFinite(obj.totalApplicationCount) &&
    obj.totalApplicationCount >= 0 &&
    typeof obj.totalAtRiskMemberCount === "number" &&
    Number.isFinite(obj.totalAtRiskMemberCount) &&
    obj.totalAtRiskMemberCount >= 0 &&
    typeof obj.totalAtRiskApplicationCount === "number" &&
    Number.isFinite(obj.totalAtRiskApplicationCount) &&
    obj.totalAtRiskApplicationCount >= 0 &&
    typeof obj.totalCriticalApplicationCount === "number" &&
    Number.isFinite(obj.totalCriticalApplicationCount) &&
    obj.totalCriticalApplicationCount >= 0 &&
    typeof obj.totalCriticalMemberCount === "number" &&
    Number.isFinite(obj.totalCriticalMemberCount) &&
    obj.totalCriticalMemberCount >= 0 &&
    typeof obj.totalCriticalAtRiskMemberCount === "number" &&
    Number.isFinite(obj.totalCriticalAtRiskMemberCount) &&
    obj.totalCriticalAtRiskMemberCount >= 0 &&
    typeof obj.totalCriticalAtRiskApplicationCount === "number" &&
    Number.isFinite(obj.totalCriticalAtRiskApplicationCount) &&
    obj.totalCriticalAtRiskApplicationCount >= 0 &&
    Array.isArray(obj.newApplications) &&
    obj.newApplications.every((app: any) => typeof app === "string" && app.length > 0)
  );
}

/**
 * Type guard to validate OrganizationReportApplication structure
 * Exported for testability
 * Strict validation: rejects objects with unexpected properties and prototype pollution
 */
export function isOrganizationReportApplication(obj: any): obj is OrganizationReportApplication {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  // Prevent prototype pollution - check prototype is Object.prototype
  if (Object.getPrototypeOf(obj) !== Object.prototype) {
    return false;
  }

  // Prevent dangerous own properties
  if (
    Object.prototype.hasOwnProperty.call(obj, "constructor") ||
    Object.prototype.hasOwnProperty.call(obj, "prototype")
  ) {
    return false;
  }

  // Strict property validation - reject unexpected properties
  const allowedKeys = ["applicationName", "isCritical", "reviewedDate"];
  const actualKeys = Object.keys(obj);
  const hasUnexpectedProps = actualKeys.some((key) => !allowedKeys.includes(key));
  if (hasUnexpectedProps) {
    return false;
  }

  return (
    typeof obj.applicationName === "string" &&
    obj.applicationName.length > 0 &&
    typeof obj.isCritical === "boolean" &&
    (obj.reviewedDate === null ||
      obj.reviewedDate instanceof Date ||
      typeof obj.reviewedDate === "string")
  );
}

/**
 * Validates and returns an array of ApplicationHealthReportDetail
 * @throws Error if validation fails
 */
export function validateApplicationHealthReportDetailArray(
  data: any,
): ApplicationHealthReportDetail[] {
  if (!Array.isArray(data)) {
    throw new Error(
      "Invalid report data: expected array of ApplicationHealthReportDetail, received non-array",
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

  return data as ApplicationHealthReportDetail[];
}

/**
 * Validates and returns OrganizationReportSummary
 * @throws Error if validation fails
 */
export function validateOrganizationReportSummary(data: any): OrganizationReportSummary {
  if (!isOrganizationReportSummary(data)) {
    const missingFields: string[] = [];

    if (typeof data?.totalMemberCount !== "number") {
      missingFields.push("totalMemberCount (number)");
    }
    if (typeof data?.totalApplicationCount !== "number") {
      missingFields.push("totalApplicationCount (number)");
    }
    if (typeof data?.totalAtRiskMemberCount !== "number") {
      missingFields.push("totalAtRiskMemberCount (number)");
    }
    if (typeof data?.totalAtRiskApplicationCount !== "number") {
      missingFields.push("totalAtRiskApplicationCount (number)");
    }
    if (typeof data?.totalCriticalApplicationCount !== "number") {
      missingFields.push("totalCriticalApplicationCount (number)");
    }
    if (typeof data?.totalCriticalMemberCount !== "number") {
      missingFields.push("totalCriticalMemberCount (number)");
    }
    if (typeof data?.totalCriticalAtRiskMemberCount !== "number") {
      missingFields.push("totalCriticalAtRiskMemberCount (number)");
    }
    if (typeof data?.totalCriticalAtRiskApplicationCount !== "number") {
      missingFields.push("totalCriticalAtRiskApplicationCount (number)");
    }
    if (!Array.isArray(data?.newApplications)) {
      missingFields.push("newApplications (string[])");
    }

    throw new Error(
      `Invalid OrganizationReportSummary: ${missingFields.length > 0 ? `missing or invalid fields: ${missingFields.join(", ")}` : "structure validation failed"}`,
    );
  }

  return data as OrganizationReportSummary;
}

/**
 * Validates and returns an array of OrganizationReportApplication
 * @throws Error if validation fails
 */
export function validateOrganizationReportApplicationArray(
  data: any,
): OrganizationReportApplication[] {
  if (!Array.isArray(data)) {
    throw new Error(
      "Invalid application data: expected array of OrganizationReportApplication, received non-array",
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

  // Convert string dates to Date objects for reviewedDate
  return data.map((item) => ({
    ...item,
    reviewedDate: item.reviewedDate
      ? item.reviewedDate instanceof Date
        ? item.reviewedDate
        : (() => {
            const date = new Date(item.reviewedDate);
            if (isNaN(date.getTime())) {
              throw new Error(`Invalid date string: ${item.reviewedDate}`);
            }
            return date;
          })()
      : null,
  })) as OrganizationReportApplication[];
}
