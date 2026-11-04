import { accessRuleErrorMessage, isAccessRuleNotFound } from "../abstractions/access-rule";

/** The form control a mapped failure points at, named as it is keyed on the edit form's group. */
export type AccessRuleErrorField = "name" | "collections" | "maxExtensionDurationSeconds";

/**
 * The server's access-rule refusals, matched as prose since no machine-readable code crosses the
 * wire. Conditions-document failures are absent, since they are client bugs. `NameRequiredLocally`
 * is the SDK's own pre-HTTP message.
 */
export const ACCESS_RULE_SERVER_ERRORS = Object.freeze({
  NameRequired: {
    serverMessage: "Name is required.",
    messageKey: "pamAccessRuleNameRequired",
    field: "name",
  },
  NameRequiredLocally: {
    serverMessage: "Name must be between 1 and 256 characters",
    messageKey: "pamAccessRuleNameRequired",
    field: "name",
  },
  NameTaken: {
    serverMessage: "A rule with that name already exists.",
    messageKey: "pamAccessRuleErrorNameTaken",
    field: "name",
  },
  ExtensionLengthRequired: {
    serverMessage: "A maximum extension length is required when extensions are allowed.",
    messageKey: "pamAccessRuleErrorExtensionLengthRequired",
    field: "maxExtensionDurationSeconds",
  },
  CollectionsMissing: {
    serverMessage: "One or more collections could not be found.",
    messageKey: "pamAccessRuleErrorCollectionsMissing",
    field: "collections",
  },
  CollectionsForeign: {
    serverMessage: "One or more collections do not belong to this organization.",
    messageKey: "pamAccessRuleErrorCollectionsForeign",
    field: "collections",
  },
  CollectionsGoverned: {
    serverMessage: "One or more collections are already governed by another access rule.",
    messageKey: "pamAccessRuleErrorCollectionsGoverned",
    field: "collections",
  },
} as const satisfies Record<
  string,
  { serverMessage: string; messageKey: string; field: AccessRuleErrorField }
>);

/**
 * `mapped` names something the admin can correct, never offered as a retry since resending would
 * fail identically. Everything else is `generic`, as the server's own words carry filesystem paths.
 */
export type AccessRuleErrorOutcome =
  | {
      readonly kind: "mapped";
      readonly messageKey: string;
      readonly field?: AccessRuleErrorField;
    }
  | { readonly kind: "generic" };

/**
 * Returns i18n keys only. The raw error never leaves this function, since its message is the
 * server's serialized response and would publish filesystem paths if shown or logged.
 */
export function classifyAccessRuleError(e: unknown): AccessRuleErrorOutcome {
  if (isAccessRuleNotFound(e)) {
    return { kind: "mapped", messageKey: "pamAccessRuleErrorMissing" };
  }

  const message = accessRuleErrorMessage(e);
  if (!message) {
    return { kind: "generic" };
  }

  const mapped = Object.values(ACCESS_RULE_SERVER_ERRORS).find((entry) =>
    message.includes(entry.serverMessage),
  );
  return mapped != null
    ? { kind: "mapped", messageKey: mapped.messageKey, field: mapped.field }
    : { kind: "generic" };
}

/** The i18n key a caller should show for a rejected access-rule call, generic copy included. */
export function accessRuleErrorMessageKey(e: unknown): string {
  const outcome = classifyAccessRuleError(e);
  return outcome.kind === "mapped" ? outcome.messageKey : "unexpectedError";
}
