import { accessRuleErrorMessage, isAccessRuleNotFound } from "../abstractions/access-rule";

/**
 * The access-rule write path's error catalog, as the server words it. Reproduced here rather than
 * imported because the strings cross the wire as prose: the SDK surfaces a server 400 as an
 * `AccessRuleError` with `variant: "Api"` and the whole serialized response body on `.message` —
 * envelope, exception message and server-side stack trace included — with no machine-readable code
 * to switch on. When the server grows a code, this catalog is the single place to retire.
 *
 * Sourced from `AccessRuleWriteValidator` and the create/update commands. The conditions-document
 * failures raised by `AccessRuleValidator` ("Conditions must be an array.", and its siblings) are
 * deliberately absent: this form builds that document itself, so any of them is a client bug the
 * admin cannot act on, and the generic system-error copy is the honest thing to show.
 */
export const ACCESS_RULE_WRITE_SERVER_ERRORS = Object.freeze({
  NameRequired: "Name is required.",
  NameTaken: "A rule with that name already exists.",
  ExtensionLengthRequired: "A maximum extension length is required when extensions are allowed.",
  CollectionsMissing: "One or more collections could not be found.",
  CollectionsForeign: "One or more collections do not belong to this organization.",
  CollectionsGoverned: "One or more collections are already governed by another access rule.",
} as const);

/** The form control a mapped failure points at, named as it is keyed on the edit form's group. */
export type AccessRuleSaveErrorField = "name" | "collections" | "maxExtensionDurationSeconds";

/**
 * How the UI should report a rejected access-rule write.
 *
 * The distinction is whether the admin can act on it. A `mapped` outcome names something they can
 * change, so it is offered as correctable copy — and never with a retry affordance, since resending
 * the same values would fail identically. Everything else is `generic`: the server's own words are
 * unfit for display (they carry its filesystem paths) and unfit for logging, so the caller shows its
 * own system-error copy and offers a retry.
 */
export type AccessRuleSaveErrorOutcome =
  | {
      readonly kind: "mapped";
      readonly messageKey: string;
      readonly field?: AccessRuleSaveErrorField;
    }
  | { readonly kind: "generic" };

const MAPPED_SERVER_ERRORS: ReadonlyArray<{
  serverMessage: string;
  messageKey: string;
  field?: AccessRuleSaveErrorField;
}> = [
  {
    serverMessage: ACCESS_RULE_WRITE_SERVER_ERRORS.NameRequired,
    messageKey: "pamAccessRuleNameRequired",
    field: "name",
  },
  {
    serverMessage: ACCESS_RULE_WRITE_SERVER_ERRORS.NameTaken,
    messageKey: "pamAccessRuleErrorNameTaken",
    field: "name",
  },
  {
    serverMessage: ACCESS_RULE_WRITE_SERVER_ERRORS.ExtensionLengthRequired,
    messageKey: "pamAccessRuleErrorExtensionLengthRequired",
    field: "maxExtensionDurationSeconds",
  },
  {
    serverMessage: ACCESS_RULE_WRITE_SERVER_ERRORS.CollectionsMissing,
    messageKey: "pamAccessRuleErrorCollectionsMissing",
    field: "collections",
  },
  {
    serverMessage: ACCESS_RULE_WRITE_SERVER_ERRORS.CollectionsForeign,
    messageKey: "pamAccessRuleErrorCollectionsForeign",
    field: "collections",
  },
  {
    serverMessage: ACCESS_RULE_WRITE_SERVER_ERRORS.CollectionsGoverned,
    messageKey: "pamAccessRuleErrorCollectionsGoverned",
    field: "collections",
  },
];

/**
 * Classify a rejected access-rule write. The returned outcome carries i18n keys only — the raw
 * error never leaves this function, which is the point: its message is the server's serialized
 * response, and putting it on screen or in a log would publish the server's filesystem paths.
 *
 * Matched with `includes` rather than equality: the wire body wraps the server's sentence in a JSON
 * envelope and repeats it in `exceptionMessage`. The catalog entries are whole, distinct sentences,
 * so a substring match is unambiguous while tolerating that framing.
 */
export function classifyAccessRuleSaveError(e: unknown): AccessRuleSaveErrorOutcome {
  if (isAccessRuleNotFound(e)) {
    return { kind: "mapped", messageKey: "pamAccessRuleErrorMissing" };
  }

  const message = accessRuleErrorMessage(e);
  if (!message) {
    return { kind: "generic" };
  }

  const mapped = MAPPED_SERVER_ERRORS.find((entry) => message.includes(entry.serverMessage));
  return mapped != null
    ? { kind: "mapped", messageKey: mapped.messageKey, field: mapped.field }
    : { kind: "generic" };
}
