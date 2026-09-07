import { accessRuleErrorMessage, isAccessRuleNotFound } from "../abstractions/access-rule";

/** The form control a mapped failure points at, named as it is keyed on the edit form's group. */
export type AccessRuleErrorField = "name" | "collections" | "maxExtensionDurationSeconds";

/**
 * The access-rule endpoints' error catalog, as the server words it, paired with the copy shown
 * instead. Reproduced here, not imported, since the strings cross the wire as prose with no
 * machine-readable code to switch on.
 *
 * Sourced from `AccessRuleWriteValidator` and the create/update commands; the conditions-document
 * failures from `AccessRuleValidator` are deliberately absent, since the edit form builds that
 * document itself and any such failure is a client bug, not something the admin can act on.
 *
 * `NameRequiredLocally` is the one exception: the SDK's own local, pre-HTTP message, with the
 * maximum interpolated at runtime. `access-rule-error.spec.ts` pins it against the SDK and
 * `ACCESS_RULE_NAME_MAX_LENGTH` directly, so a reword or a lowered cap fails that spec instead of
 * silently degrading to the generic banner.
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
 * How the UI should report a rejected access-rule read, write or delete.
 *
 * The distinction is whether the admin can act on it. A `mapped` outcome names something
 * correctable — never with a retry on the write path, since resending the same values would
 * fail identically. Everything else is `generic`: the server's own words carry filesystem paths,
 * unfit for display or logging.
 */
export type AccessRuleErrorOutcome =
  | {
      readonly kind: "mapped";
      readonly messageKey: string;
      readonly field?: AccessRuleErrorField;
    }
  | { readonly kind: "generic" };

/**
 * Classify a rejected access-rule call. The returned outcome carries i18n keys only — the raw
 * error never leaves this function, since its message is the server's serialized response and
 * would publish filesystem paths if shown or logged.
 *
 * Matched with `includes`, not equality: the wire body wraps the server's sentence in a JSON
 * envelope and repeats it in `exceptionMessage`, so a substring match tolerates the framing.
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
