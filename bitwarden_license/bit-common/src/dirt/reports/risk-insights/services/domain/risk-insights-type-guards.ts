import {
  ApplicationHealthReportDetail,
  MemberDetails,
  OrganizationReportApplication,
  OrganizationReportSummary,
} from "../../models";

/**
 * Security limits for validation (prevent DoS attacks and ensure reasonable data sizes)
 */
const MAX_STRING_LENGTH = 1000; // Reasonable limit for names, emails, GUIDs
const MAX_ARRAY_LENGTH = 50000; // Reasonable limit for report arrays
const MAX_COUNT = 10000000; // 10 million - reasonable upper bound for count fields

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

  // Prevent dangerous properties that could be used for prototype pollution
  // Check for __proto__, constructor, and prototype as own properties
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  for (const key of dangerousKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
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
    obj.userGuid.length <= MAX_STRING_LENGTH &&
    (obj.userName === null ||
      obj.userName === undefined ||
      (typeof obj.userName === "string" &&
        obj.userName.length > 0 &&
        obj.userName.length <= MAX_STRING_LENGTH)) &&
    typeof obj.email === "string" &&
    obj.email.length > 0 &&
    obj.email.length <= MAX_STRING_LENGTH &&
    typeof obj.cipherId === "string" &&
    obj.cipherId.length > 0 &&
    obj.cipherId.length <= MAX_STRING_LENGTH
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

  // Prevent dangerous properties that could be used for prototype pollution
  // Check for __proto__, constructor, and prototype as own properties
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  for (const key of dangerousKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
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
    obj.applicationName.length <= MAX_STRING_LENGTH &&
    typeof obj.passwordCount === "number" &&
    Number.isFinite(obj.passwordCount) &&
    Number.isSafeInteger(obj.passwordCount) &&
    obj.passwordCount >= 0 &&
    obj.passwordCount <= MAX_COUNT &&
    typeof obj.atRiskPasswordCount === "number" &&
    Number.isFinite(obj.atRiskPasswordCount) &&
    Number.isSafeInteger(obj.atRiskPasswordCount) &&
    obj.atRiskPasswordCount >= 0 &&
    obj.atRiskPasswordCount <= MAX_COUNT &&
    Array.isArray(obj.atRiskCipherIds) &&
    obj.atRiskCipherIds.length <= MAX_ARRAY_LENGTH &&
    obj.atRiskCipherIds.every(
      (id: any) => typeof id === "string" && id.length > 0 && id.length <= MAX_STRING_LENGTH,
    ) &&
    typeof obj.memberCount === "number" &&
    Number.isFinite(obj.memberCount) &&
    Number.isSafeInteger(obj.memberCount) &&
    obj.memberCount >= 0 &&
    obj.memberCount <= MAX_COUNT &&
    typeof obj.atRiskMemberCount === "number" &&
    Number.isFinite(obj.atRiskMemberCount) &&
    Number.isSafeInteger(obj.atRiskMemberCount) &&
    obj.atRiskMemberCount >= 0 &&
    obj.atRiskMemberCount <= MAX_COUNT &&
    Array.isArray(obj.memberDetails) &&
    obj.memberDetails.length <= MAX_ARRAY_LENGTH &&
    obj.memberDetails.every(isMemberDetails) &&
    Array.isArray(obj.atRiskMemberDetails) &&
    obj.atRiskMemberDetails.length <= MAX_ARRAY_LENGTH &&
    obj.atRiskMemberDetails.every(isMemberDetails) &&
    Array.isArray(obj.cipherIds) &&
    obj.cipherIds.length <= MAX_ARRAY_LENGTH &&
    obj.cipherIds.every(
      (id: any) => typeof id === "string" && id.length > 0 && id.length <= MAX_STRING_LENGTH,
    )
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

  // Prevent dangerous properties that could be used for prototype pollution
  // Check for __proto__, constructor, and prototype as own properties
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  for (const key of dangerousKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
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
    Number.isSafeInteger(obj.totalMemberCount) &&
    obj.totalMemberCount >= 0 &&
    obj.totalMemberCount <= MAX_COUNT &&
    typeof obj.totalApplicationCount === "number" &&
    Number.isFinite(obj.totalApplicationCount) &&
    Number.isSafeInteger(obj.totalApplicationCount) &&
    obj.totalApplicationCount >= 0 &&
    obj.totalApplicationCount <= MAX_COUNT &&
    typeof obj.totalAtRiskMemberCount === "number" &&
    Number.isFinite(obj.totalAtRiskMemberCount) &&
    Number.isSafeInteger(obj.totalAtRiskMemberCount) &&
    obj.totalAtRiskMemberCount >= 0 &&
    obj.totalAtRiskMemberCount <= MAX_COUNT &&
    typeof obj.totalAtRiskApplicationCount === "number" &&
    Number.isFinite(obj.totalAtRiskApplicationCount) &&
    Number.isSafeInteger(obj.totalAtRiskApplicationCount) &&
    obj.totalAtRiskApplicationCount >= 0 &&
    obj.totalAtRiskApplicationCount <= MAX_COUNT &&
    typeof obj.totalCriticalApplicationCount === "number" &&
    Number.isFinite(obj.totalCriticalApplicationCount) &&
    Number.isSafeInteger(obj.totalCriticalApplicationCount) &&
    obj.totalCriticalApplicationCount >= 0 &&
    obj.totalCriticalApplicationCount <= MAX_COUNT &&
    typeof obj.totalCriticalMemberCount === "number" &&
    Number.isFinite(obj.totalCriticalMemberCount) &&
    Number.isSafeInteger(obj.totalCriticalMemberCount) &&
    obj.totalCriticalMemberCount >= 0 &&
    obj.totalCriticalMemberCount <= MAX_COUNT &&
    typeof obj.totalCriticalAtRiskMemberCount === "number" &&
    Number.isFinite(obj.totalCriticalAtRiskMemberCount) &&
    Number.isSafeInteger(obj.totalCriticalAtRiskMemberCount) &&
    obj.totalCriticalAtRiskMemberCount >= 0 &&
    obj.totalCriticalAtRiskMemberCount <= MAX_COUNT &&
    typeof obj.totalCriticalAtRiskApplicationCount === "number" &&
    Number.isFinite(obj.totalCriticalAtRiskApplicationCount) &&
    Number.isSafeInteger(obj.totalCriticalAtRiskApplicationCount) &&
    obj.totalCriticalAtRiskApplicationCount >= 0 &&
    obj.totalCriticalAtRiskApplicationCount <= MAX_COUNT &&
    // newApplications is optional (backward compatibility - not in type definition)
    (obj.newApplications === undefined ||
      (Array.isArray(obj.newApplications) &&
        obj.newApplications.length <= MAX_ARRAY_LENGTH &&
        obj.newApplications.every(
          (app: any) =>
            typeof app === "string" && app.length > 0 && app.length <= MAX_STRING_LENGTH,
        )))
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

  // Prevent dangerous properties that could be used for prototype pollution
  // Check for __proto__, constructor, and prototype as own properties
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  for (const key of dangerousKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
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
    obj.applicationName.length <= MAX_STRING_LENGTH &&
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

  if (data.length > MAX_ARRAY_LENGTH) {
    throw new Error(
      `Invalid report data: array length ${data.length} exceeds maximum allowed length ${MAX_ARRAY_LENGTH}`,
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
    // newApplications is optional (backward compatibility - not in type definition)
    // Only validate if present
    if (
      data?.newApplications !== undefined &&
      (!Array.isArray(data?.newApplications) ||
        !data.newApplications.every((app: any) => typeof app === "string"))
    ) {
      missingFields.push("newApplications (optional string[])");
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

  if (data.length > MAX_ARRAY_LENGTH) {
    throw new Error(
      `Invalid application data: array length ${data.length} exceeds maximum allowed length ${MAX_ARRAY_LENGTH}`,
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
