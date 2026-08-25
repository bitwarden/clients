import { accessRuleErrorMessage, isAccessRuleNotFound } from "../abstractions/access-rule";

/** The form control a mapped failure points at, named as it is keyed on the edit form's group. */
export type AccessRuleErrorField = "name" | "collections" | "maxExtensionDurationSeconds";

/**
 * The access-rule endpoints' error catalog, as the server words it, paired with the copy we show
 * instead. Reproduced here rather than imported because the strings cross the wire as prose: the
 * SDK surfaces a server 400 as an `AccessRuleError` with `variant: "Api"` and the whole serialized
 * response body on `.message` — envelope, exception message and server-side stack trace included —
 * with no machine-readable code to switch on. When the server grows a code, this catalog is the
 * single place to retire.
 *
 * Sourced from `AccessRuleWriteValidator` and the create/update commands. The conditions-document
 * failures raised by `AccessRuleValidator` ("Conditions must be an array.", and its siblings) are
 * deliberately absent: the edit form builds that document itself, so any of them is a client bug
 * the admin cannot act on, and the generic system-error copy is the honest thing to show.
 * `NameRequiredLocally` is the one exception to "sourced from the server": it's the SDK's own
 * local (pre-HTTP) validation message, never a wire body.
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
 * The distinction is whether the admin can act on it. A `mapped` outcome names something they can
 * change, so it is offered as correctable copy — and, on the write path, never with a retry
 * affordance, since resending the same values would fail identically. Everything else is `generic`:
 * the server's own words are unfit for display (they carry its filesystem paths) and unfit for
 * logging, so the caller shows its own system-error copy.
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
 * error never leaves this function, which is the point: its message is the server's serialized
 * response, and putting it on screen or in a log would publish the server's filesystem paths.
 *
 * Matched with `includes` rather than equality: the wire body wraps the server's sentence in a JSON
 * envelope and repeats it in `exceptionMessage`. The catalog entries are whole, distinct sentences,
 * so a substring match is unambiguous while tolerating that framing.
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
