import { type AccessRuleErrorVariant, accessRuleErrorVariant } from "../abstractions/access-rule";

/** The form control a mapped failure points at, named as it is keyed on the edit form's group. */
export type AccessRuleErrorField = "name" | "collections" | "maxExtensionDurationSeconds";

/**
 * The access-rule write failures the admin can act on, keyed by the SDK variant the server's error
 * code maps to, paired with our copy and the control to mark invalid.
 *
 * This used to be a catalog of the server's English sentences matched with `String.includes()`.
 * The variant is the server's stable code, so a reword on the server side no longer silently drops
 * a mapped failure back to generic copy.
 *
 * The rule's own duration bounds (`DefaultDurationMustBePositive` and its siblings) are absent
 * deliberately: the edit form's pickers cannot produce them, so any of them is a client bug the
 * admin cannot act on, and the generic system-error copy is the honest thing to show. Same for the
 * conditions document, which the form builds itself.
 */
export const ACCESS_RULE_ERROR_COPY: Partial<
  Record<AccessRuleErrorVariant, { messageKey: string; field?: AccessRuleErrorField }>
> = {
  NotFound: { messageKey: "pamAccessRuleErrorMissing" },
  NameRequired: { messageKey: "pamAccessRuleNameRequired", field: "name" },
  NameTaken: { messageKey: "pamAccessRuleErrorNameTaken", field: "name" },
  ExtensionLengthRequired: {
    messageKey: "pamAccessRuleErrorExtensionLengthRequired",
    field: "maxExtensionDurationSeconds",
  },
  CollectionsMissing: { messageKey: "pamAccessRuleErrorCollectionsMissing", field: "collections" },
  CollectionsForeign: { messageKey: "pamAccessRuleErrorCollectionsForeign", field: "collections" },
  CollectionsAlreadyGoverned: {
    messageKey: "pamAccessRuleErrorCollectionsGoverned",
    field: "collections",
  },
};

/**
 * How the UI should report a rejected access-rule read, write or delete.
 *
 * The distinction is whether the admin can act on it. A `mapped` outcome names something they can
 * change, so it is offered as correctable copy — and, on the write path, never with a retry
 * affordance, since resending the same values would fail identically. Everything else is `generic`.
 */
export type AccessRuleErrorOutcome =
  | {
      readonly kind: "mapped";
      readonly messageKey: string;
      readonly field?: AccessRuleErrorField;
    }
  | { readonly kind: "generic" };

/**
 * Classify a rejected access-rule call by the variant the SDK surfaced.
 *
 * The raw error still never leaves this function. It no longer has to: the variant carries
 * everything the UI needs, so nothing here has to reach into a message that used to arrive as the
 * server's whole serialized response — envelope, exception message and filesystem paths included.
 */
export function classifyAccessRuleError(e: unknown): AccessRuleErrorOutcome {
  const variant = accessRuleErrorVariant(e);
  if (variant == null) {
    return { kind: "generic" };
  }

  const mapped = ACCESS_RULE_ERROR_COPY[variant];
  return mapped != null
    ? { kind: "mapped", messageKey: mapped.messageKey, field: mapped.field }
    : { kind: "generic" };
}

/** The i18n key a caller should show for a rejected access-rule call, generic copy included. */
export function accessRuleErrorMessageKey(e: unknown): string {
  const outcome = classifyAccessRuleError(e);
  return outcome.kind === "mapped" ? outcome.messageKey : "unexpectedError";
}
