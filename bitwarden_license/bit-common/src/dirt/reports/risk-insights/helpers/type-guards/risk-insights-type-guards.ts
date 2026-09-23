import { CipherId } from "@bitwarden/common/types/guid";

import {
  MemberRegistryEntryData,
  AccessReportSettingsData,
  ApplicationHealthData,
  AccessReportSummaryView,
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
  createEnhancedBoundedArrayGuard,
  createValidator,
  isBoolean,
  isBooleanRecord,
  isBoundedString,
  isBoundedStringOrNull,
  isBoundedStringOrUndefined,
  isBoundedPositiveNumber,
  isBoundedPositiveNumberOrUndefined,
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
  // Optional in old blobs — absent keys are accepted and normalized to 0 in validateOrganizationReportSummary
  totalPasswordCount: isBoundedPositiveNumberOrUndefined as (v: unknown) => v is number,
  totalAtRiskPasswordCount: isBoundedPositiveNumberOrUndefined as (v: unknown) => v is number,
  totalCriticalPasswordCount: isBoundedPositiveNumberOrUndefined as (v: unknown) => v is number,
  totalCriticalAtRiskPasswordCount: isBoundedPositiveNumberOrUndefined as (
    v: unknown,
  ) => v is number,
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
 * Result of a validate function. `data` contains everything that passed validation
 * (with invalid elements dropped or invalid fields defaulted). `errors` contains one
 * explain-style message per failure, suitable for logging. Callers decide how to
 * surface errors (log a warning, ignore, etc.). Structural failures (non-array,
 * length exceeded, non-object) still throw.
 */
export type ValidationResult<T> = {
  data: T;
  errors: string[];
};

/**
 * Validates an array of ApplicationHealthReportDetail. Invalid elements are dropped
 * from the returned data and recorded in errors. Throws on structural failures only
 * (non-array, length > {@link BOUNDED_ARRAY_MAX_LENGTH}).
 */
export function validateApplicationHealthReportDetailArray(
  data: unknown,
): ValidationResult<ApplicationHealthReportDetail[]> {
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

  const validItems: ApplicationHealthReportDetail[] = [];
  const errors: string[] = [];

  data.forEach((item, index) => {
    if (isApplicationHealthReportDetail(item)) {
      validItems.push(item);
    } else {
      const fieldErrors = isApplicationHealthReportDetail.explain(item).join("; ");
      errors.push(`element[${index}]: ${fieldErrors}`);
    }
  });

  return { data: validItems, errors };
}

/**
 * Validates an OrganizationReportSummary. Invalid fields are defaulted to 0 and
 * recorded in errors. Throws if the value is not an object.
 */
export function validateOrganizationReportSummary(
  data: unknown,
): ValidationResult<OrganizationReportSummary> {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid report summary: expected object, received non-object");
  }

  const obj = data as Record<string, unknown>;
  const errors: string[] = [];

  const readNumber = (key: string): number => {
    const value = obj[key];
    if (isBoundedPositiveNumber(value)) {
      return value;
    }
    // Undefined is normalized silently (some fields are optional in old blobs);
    // any other invalid value defaults to 0 and is reported.
    if (value !== undefined) {
      errors.push(`field '${key}': not a valid bounded positive number`);
    }
    return 0;
  };

  const summary: OrganizationReportSummary = {
    totalMemberCount: readNumber("totalMemberCount"),
    totalApplicationCount: readNumber("totalApplicationCount"),
    totalAtRiskMemberCount: readNumber("totalAtRiskMemberCount"),
    totalAtRiskApplicationCount: readNumber("totalAtRiskApplicationCount"),
    totalCriticalApplicationCount: readNumber("totalCriticalApplicationCount"),
    totalCriticalMemberCount: readNumber("totalCriticalMemberCount"),
    totalCriticalAtRiskMemberCount: readNumber("totalCriticalAtRiskMemberCount"),
    totalCriticalAtRiskApplicationCount: readNumber("totalCriticalAtRiskApplicationCount"),
    totalPasswordCount: readNumber("totalPasswordCount"),
    totalAtRiskPasswordCount: readNumber("totalAtRiskPasswordCount"),
    totalCriticalPasswordCount: readNumber("totalCriticalPasswordCount"),
    totalCriticalAtRiskPasswordCount: readNumber("totalCriticalAtRiskPasswordCount"),
  };

  return { data: summary, errors };
}

// Local type representing only the count fields stored in the encrypted summary blob.
// `date` is not part of the blob — it comes from the API envelope and is set after decryption.
type SummaryBlobPayload = Pick<
  AccessReportSummaryView,
  | "totalMemberCount"
  | "totalApplicationCount"
  | "totalAtRiskMemberCount"
  | "totalAtRiskApplicationCount"
  | "totalCriticalApplicationCount"
  | "totalCriticalMemberCount"
  | "totalCriticalAtRiskMemberCount"
  | "totalCriticalAtRiskApplicationCount"
  | "totalPasswordCount"
  | "totalAtRiskPasswordCount"
  | "totalCriticalPasswordCount"
  | "totalCriticalAtRiskPasswordCount"
>;

export const isAccessReportSummaryView = createValidator<SummaryBlobPayload>({
  totalMemberCount: isBoundedPositiveNumber,
  totalApplicationCount: isBoundedPositiveNumber,
  totalAtRiskMemberCount: isBoundedPositiveNumber,
  totalAtRiskApplicationCount: isBoundedPositiveNumber,
  totalCriticalApplicationCount: isBoundedPositiveNumber,
  totalCriticalMemberCount: isBoundedPositiveNumber,
  totalCriticalAtRiskMemberCount: isBoundedPositiveNumber,
  totalCriticalAtRiskApplicationCount: isBoundedPositiveNumber,
  // Optional — absent in blobs written before password counts were added; default to 0 in fromJSON
  totalPasswordCount: isBoundedPositiveNumberOrUndefined as (v: unknown) => v is number,
  totalAtRiskPasswordCount: isBoundedPositiveNumberOrUndefined as (v: unknown) => v is number,
  totalCriticalPasswordCount: isBoundedPositiveNumberOrUndefined as (v: unknown) => v is number,
  totalCriticalAtRiskPasswordCount: isBoundedPositiveNumberOrUndefined as (
    v: unknown,
  ) => v is number,
});

/**
 * Validates the raw blob payload and constructs an {@link AccessReportSummaryView}.
 * @throws Error if validation fails
 */
export function validateAccessReportSummaryView(data: unknown): AccessReportSummaryView {
  if (!isAccessReportSummaryView(data)) {
    throw new Error("Invalid report summary");
  }
  return AccessReportSummaryView.fromJSON(data);
}

/**
 * Validates an array of OrganizationReportApplication. Invalid elements are dropped
 * from the returned data and recorded in errors. Valid elements have their
 * reviewedDate normalized from string to Date. Throws on structural failures only
 * (non-array, length > {@link BOUNDED_ARRAY_MAX_LENGTH}).
 */
export function validateOrganizationReportApplicationArray(
  data: unknown,
): ValidationResult<OrganizationReportApplication[]> {
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

  const validItems: OrganizationReportApplication[] = [];
  const errors: string[] = [];

  data.forEach((item, index) => {
    if (!isOrganizationReportApplication(item)) {
      const fieldErrors = isOrganizationReportApplication.explain(item).join("; ");
      errors.push(`element[${index}]: ${fieldErrors}`);
      return;
    }

    // Normalize reviewedDate: old blobs may store ISO strings instead of Date objects.
    // isOrganizationReportApplication accepts both via isValidDateOrNull.
    let reviewedDate: Date | null;
    if (item.reviewedDate == null) {
      reviewedDate = null;
    } else if (item.reviewedDate instanceof Date) {
      reviewedDate = item.reviewedDate;
    } else {
      const date = new Date(item.reviewedDate as unknown as string);
      if (!isDate(date)) {
        errors.push(`element[${index}]: field 'reviewedDate': invalid date string`);
        return;
      }
      reviewedDate = date;
    }

    validItems.push({ ...item, reviewedDate });
  });

  return { data: validItems, errors };
}

const isAccessReportSettingsData = createValidator<AccessReportSettingsData>({
  applicationName: isBoundedString,
  isCritical: isBoolean,
  reviewedDate: isDateStringOrUndefined,
});
export const isAccessReportSettingsDataArray = createBoundedArrayGuard(isAccessReportSettingsData);

/**
 * Validates an array of AccessReportSettingsData. Invalid elements are dropped from
 * the returned data and recorded in `errors`. Throws on structural failures only
 * (non-array, length > {@link BOUNDED_ARRAY_MAX_LENGTH}).
 */
export function validateAccessReportSettingsDataArray(
  data: unknown,
): ValidationResult<AccessReportSettingsData[]> {
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

  const validItems: AccessReportSettingsData[] = [];
  const errors: string[] = [];

  data.forEach((item, index) => {
    if (isAccessReportSettingsData(item)) {
      validItems.push(item);
    } else {
      const fieldErrors = isAccessReportSettingsData.explain(item).join("; ");
      errors.push(`element[${index}]: ${fieldErrors}`);
    }
  });

  return { data: validItems, errors };
}

/**
 * Validates an AccessReportPayload. Invalid `reports[]` elements and `memberRegistry`
 * entries are dropped from the returned data and recorded in `errors`. Throws on
 * structural failures only (non-object payload, non-array `reports`, `reports` length
 * or `memberRegistry` size > {@link BOUNDED_ARRAY_MAX_LENGTH}, non-object `memberRegistry`).
 */
export function validateAccessReportPayload(data: unknown): ValidationResult<AccessReportPayload> {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid report payload: expected object, received non-object");
  }

  const obj = data as Record<string, unknown>;
  const errors: string[] = [];

  // reports: drop invalid elements; structural failures (non-array, length) still throw.
  const rawReports = obj["reports"];
  if (!Array.isArray(rawReports)) {
    throw new Error("Invalid report payload: reports expected array, received non-array");
  }
  if (rawReports.length > BOUNDED_ARRAY_MAX_LENGTH) {
    throw new Error(
      `Invalid report payload: reports array length ${rawReports.length} exceeds maximum allowed length ${BOUNDED_ARRAY_MAX_LENGTH}`,
    );
  }

  const reports: ApplicationHealthData[] = [];
  rawReports.forEach((item, index) => {
    if (isApplicationHealthData(item)) {
      reports.push(item);
    } else {
      const fieldErrors = isApplicationHealthData.explain(item).join("; ");
      errors.push(`reports[${index}]: ${fieldErrors}`);
    }
  });

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

  // memberRegistry: drop invalid entries; structural failures (non-object, size) still throw.
  const rawRegistry = obj["memberRegistry"];
  if (rawRegistry == null || typeof rawRegistry !== "object" || Array.isArray(rawRegistry)) {
    throw new Error("Invalid report payload: memberRegistry expected object, received non-object");
  }

  const registryEntries = Object.entries(rawRegistry as Record<string, unknown>);
  if (registryEntries.length > BOUNDED_ARRAY_MAX_LENGTH) {
    throw new Error(
      `Invalid report payload: memberRegistry size ${registryEntries.length} exceeds maximum allowed length ${BOUNDED_ARRAY_MAX_LENGTH}`,
    );
  }

  const memberRegistry: Record<string, MemberRegistryEntryData> = {};
  for (const [key, entry] of registryEntries) {
    if (!isBoundedString(key)) {
      errors.push(`memberRegistry: dropped entry with invalid key`);
      continue;
    }
    if (isMemberRegistryEntryData(entry)) {
      memberRegistry[key] = entry;
    } else {
      const fieldErrors = isMemberRegistryEntryData.explain(entry).join("; ");
      errors.push(`memberRegistry["${key}"]: ${fieldErrors}`);
    }
  }

  return { data: { reports, memberRegistry }, errors };
}
