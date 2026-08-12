import {
  AgentFillCandidate,
  AgentFillFieldRole,
  AgentFillFormClass,
  AgentFillRefusalReason,
} from "@bitwarden/common/autofill/agent-fill";

import AutofillField from "../models/autofill-field";

import { PageDetail } from "./abstractions/autofill.service";
import { InlineMenuFieldQualificationService } from "./abstractions/inline-menu-field-qualifications.service";
import { AutoFillConstants } from "./autofill-constants";

/**
 * Agent-fill target planner — pure selection logic for the Agent Access browser-fill feature.
 *
 * Enforces the plan §4.1 invariants at plan time (the content script re-enforces them at write
 * time — see {@link InsertAutofillContentService.fillAgentFields}):
 * - A password may only ever target an `<input type="password">`. No heuristic ("looks like a
 *   password field") path exists here, deliberately — the inline-menu qualification service's
 *   `isLikePasswordField` treats text inputs named "password" as password fields and MUST NOT be
 *   used for candidate selection, only ever for refusing.
 * - Hidden fields (non-viewable or aria-hidden) are never candidates.
 * - Frames whose document origin differs from the tab origin are excluded entirely.
 * - Registration-shaped forms are refused, never filled.
 * - Ambiguity (multiple candidate login forms, or multiple equally-qualified fields for a role)
 *   is a refusal, never a guess.
 *
 * The planner is value-free: it reads collected page structure and never touches credential
 * values. Field `value`s present in collected page details are never copied into the plan.
 */

/** How the deciding role selections map to concrete page elements. */
export type AgentFillSelection = {
  role: AgentFillFieldRole;
  opid: string;
  frameId: number;
  /**
   * Stable drift-comparison key for the selected element, built from
   * {@link buildAgentFillFieldSignature}. Compared by string equality at fill time.
   */
  signature: string;
  /** Human-readable target descriptor for the wire. Never a value. */
  target: string;
  frame: string;
  visible: boolean;
};

export type AgentFillPlan = {
  origin: string;
  formClass: AgentFillFormClass;
  candidates: AgentFillCandidate[];
  refusals: { role: AgentFillFieldRole; reason: AgentFillRefusalReason }[];
  /** The selected fill target per role. A missing role has no §4.1-safe target on this page. */
  selections: Partial<Record<AgentFillFieldRole, AgentFillSelection>>;
  /** Page-level refusal reason, set when no role could be planned. */
  pageRefusal?: AgentFillRefusalReason;
};

/** Parses the origin of a URL; returns null for missing/unparseable/opaque origins. */
export function originOf(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const origin = new URL(url).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

/**
 * Builds the drift-comparison signature for a selected field. Deliberately excludes `value` and
 * any label text — it identifies the element, it never describes its contents.
 */
export function buildAgentFillFieldSignature(field: AutofillField, frameId: number): string {
  return JSON.stringify({
    opid: field.opid,
    frameId,
    htmlID: field.htmlID ?? null,
    htmlName: field.htmlName ?? null,
    type: field.type ?? null,
    autoCompleteType: field.autoCompleteType ?? null,
  });
}

type FieldEntry = {
  field: AutofillField;
  detail: PageDetail;
};

const USERNAME_INPUT_TYPES = new Set(["text", "email", "tel"]);
const TOTP_TIER2_INPUT_TYPES = new Set(["text", "number", "tel"]);
const MAX_TOTP_LENGTH = 10;

export class AgentFillPlanner {
  constructor(
    private fieldQualifier: Pick<
      InlineMenuFieldQualificationService,
      "isNewPasswordField" | "isTotpField"
    >,
  ) {}

  plan(pageDetails: PageDetail[], tab: chrome.tabs.Tab): AgentFillPlan {
    const tabOrigin = originOf(tab?.url);
    if (tabOrigin == null) {
      return this.refusalPlan("", "none", []);
    }

    // Origin binding: only frames whose own document origin equals the tab origin participate.
    const sameOriginDetails: PageDetail[] = [];
    let crossOriginHasLoginSurface = false;
    for (const detail of pageDetails ?? []) {
      if (originOf(detail?.details?.url) === tabOrigin) {
        sameOriginDetails.push(detail);
      } else if (
        (detail?.details?.fields ?? []).some(
          (field) => this.isPasswordTypeInput(field) || this.isConsiderableInput(field),
        )
      ) {
        crossOriginHasLoginSurface = true;
      }
    }

    const allEntries: FieldEntry[] = sameOriginDetails.flatMap((detail) =>
      (detail.details?.fields ?? []).map((field) => ({ field, detail })),
    );

    const passwordTyped = allEntries.filter((entry) => this.isPasswordTypeInput(entry.field));
    const viablePasswords = passwordTyped.filter((entry) => this.isConsiderable(entry.field));

    if (viablePasswords.length === 0) {
      if (passwordTyped.length > 0) {
        // Password inputs exist but none is viewable — honeypot territory. Refuse the whole page
        // rather than planning around fields nobody can see.
        return this.refusalPlan(tabOrigin, "none", [
          { role: "password", reason: "hidden-field-only" },
        ]);
      }
      return this.planWithoutPasswordField(tabOrigin, allEntries, crossOriginHasLoginSurface);
    }

    // Group viable password fields into candidate forms and split off registration-shaped ones.
    const groups = new Map<string, FieldEntry[]>();
    for (const entry of viablePasswords) {
      const key = `${entry.detail.frameId}:${entry.field.form ?? "__formless__"}`;
      const group = groups.get(key) ?? [];
      group.push(entry);
      groups.set(key, group);
    }

    const loginGroups: FieldEntry[][] = [];
    let sawRegistrationGroup = false;
    for (const group of groups.values()) {
      if (this.isRegistrationGroup(group)) {
        sawRegistrationGroup = true;
      } else {
        loginGroups.push(group);
      }
    }

    if (loginGroups.length === 0 && sawRegistrationGroup) {
      return this.refusalPlan(tabOrigin, "registration", [
        { role: "password", reason: "looks-like-registration" },
      ]);
    }
    if (loginGroups.length > 1) {
      return this.refusalPlan(tabOrigin, "ambiguous", [
        { role: "password", reason: "ambiguous-target" },
      ]);
    }

    // Exactly one candidate login form with exactly one viable password field (two or more in the
    // same form is classified registration above).
    const passwordEntry = loginGroups[0][0];
    return this.planAroundPasswordField(tabOrigin, allEntries, passwordEntry);
  }

  private planAroundPasswordField(
    tabOrigin: string,
    allEntries: FieldEntry[],
    passwordEntry: FieldEntry,
  ): AgentFillPlan {
    const selections: AgentFillPlan["selections"] = {};
    const refusals: AgentFillPlan["refusals"] = [];

    const sameFormEntries = allEntries.filter(
      (entry) =>
        entry.detail.frameId === passwordEntry.detail.frameId &&
        (entry.field.form ?? null) === (passwordEntry.field.form ?? null) &&
        entry.field.opid !== passwordEntry.field.opid &&
        this.isConsiderableInput(entry.field) &&
        entry.field.type !== "password",
    );

    // Username: autocomplete username/email outranks bare text/email/tel typing; a tie within the
    // deciding tier is a refusal, never a guess.
    const usernameTier1 = sameFormEntries.filter(
      (entry) =>
        this.autoCompleteIncludes(entry.field, "username") ||
        this.autoCompleteIncludes(entry.field, "email"),
    );
    const usernameTier2 = sameFormEntries.filter(
      (entry) =>
        entry.field.type != null &&
        USERNAME_INPUT_TYPES.has(entry.field.type) &&
        !this.fieldQualifier.isTotpField(entry.field) &&
        !this.looksLikePasswordAttributes(entry.field),
    );
    const usernameTier = usernameTier1.length > 0 ? usernameTier1 : usernameTier2;

    if (usernameTier.length === 1) {
      selections.username = this.toSelection("username", usernameTier[0], tabOrigin, "login");
    } else if (usernameTier.length > 1) {
      refusals.push({ role: "username", reason: "ambiguous-target" });
    }

    const formClass: AgentFillFormClass =
      usernameTier.length === 0 ? "multi-step-password" : "login";

    selections.password = this.toSelection("password", passwordEntry, tabOrigin, formClass);

    const totpEntry = this.selectTotp(sameFormEntries, refusals);
    if (totpEntry) {
      selections.totp = this.toSelection("totp", totpEntry, tabOrigin, formClass);
    }

    return {
      origin: tabOrigin,
      formClass,
      candidates: this.toCandidates(selections),
      refusals,
      selections,
    };
  }

  private planWithoutPasswordField(
    tabOrigin: string,
    allEntries: FieldEntry[],
    crossOriginHasLoginSurface: boolean,
  ): AgentFillPlan {
    const considerable = allEntries.filter((entry) => this.isConsiderableInput(entry.field));

    const totpCandidates = this.totpCandidates(considerable);

    const usernameTier1 = considerable.filter(
      (entry) =>
        this.autoCompleteIncludes(entry.field, "username") ||
        this.autoCompleteIncludes(entry.field, "email"),
    );
    const usernameTier2 = considerable.filter(
      (entry) =>
        entry.field.type != null &&
        USERNAME_INPUT_TYPES.has(entry.field.type) &&
        !this.fieldQualifier.isTotpField(entry.field) &&
        !this.looksLikePasswordAttributes(entry.field),
    );

    if (usernameTier1.length === 1) {
      return this.multiStepUsernamePlan(tabOrigin, usernameTier1[0]);
    }
    if (usernameTier1.length > 1) {
      return this.refusalPlan(tabOrigin, "ambiguous", [
        { role: "username", reason: "ambiguous-target" },
      ]);
    }
    // Without an explicit autocomplete marker a page only reads as a username step when exactly
    // one qualified input exists — anything busier is not login-ish enough to guess at.
    if (usernameTier2.length === 1 && totpCandidates.length === 0) {
      return this.multiStepUsernamePlan(tabOrigin, usernameTier2[0]);
    }

    // A lone one-time-code input (MFA step) is describable even though no login form exists.
    if (totpCandidates.length === 1 && usernameTier2.length === 0) {
      const selections: AgentFillPlan["selections"] = {
        totp: this.toSelection("totp", totpCandidates[0], tabOrigin, "none"),
      };
      return {
        origin: tabOrigin,
        formClass: "none",
        candidates: this.toCandidates(selections),
        refusals: [{ role: "password", reason: "no-password-field" }],
        selections,
      };
    }

    // A page whose only password-intent field is a non-password input (e.g. a text input named
    // "password") has no §4.1-safe password target: refuse with no-password-field and never let
    // that field qualify for any role.
    if (allEntries.some((entry) => this.looksLikePasswordAttributes(entry.field))) {
      return this.refusalPlan(tabOrigin, "none", [
        { role: "password", reason: "no-password-field" },
      ]);
    }

    if (crossOriginHasLoginSurface) {
      return this.refusalPlan(tabOrigin, "none", [
        { role: "password", reason: "cross-origin-frame" },
      ]);
    }

    return this.refusalPlan(tabOrigin, "none", []);
  }

  private multiStepUsernamePlan(tabOrigin: string, entry: FieldEntry): AgentFillPlan {
    const selections: AgentFillPlan["selections"] = {
      username: this.toSelection("username", entry, tabOrigin, "multi-step-username"),
    };
    return {
      origin: tabOrigin,
      formClass: "multi-step-username",
      candidates: this.toCandidates(selections),
      refusals: [],
      selections,
    };
  }

  private selectTotp(
    sameFormEntries: FieldEntry[],
    refusals: AgentFillPlan["refusals"],
  ): FieldEntry | undefined {
    const candidates = this.totpCandidates(sameFormEntries);
    if (candidates.length === 1) {
      return candidates[0];
    }
    if (candidates.length > 1) {
      refusals.push({ role: "totp", reason: "ambiguous-target" });
    }
    return undefined;
  }

  /** TOTP candidates: autocomplete one-time-code, or a short numeric input. Never a password field. */
  private totpCandidates(entries: FieldEntry[]): FieldEntry[] {
    const eligible = entries.filter(
      (entry) => this.isConsiderableInput(entry.field) && entry.field.type !== "password",
    );
    const tier1 = eligible.filter((entry) =>
      this.autoCompleteIncludes(entry.field, "one-time-code"),
    );
    if (tier1.length > 0) {
      return tier1;
    }
    return eligible.filter(
      (entry) =>
        entry.field.type != null &&
        TOTP_TIER2_INPUT_TYPES.has(entry.field.type) &&
        this.fieldQualifier.isTotpField(entry.field) &&
        (entry.field.type === "number" ||
          (entry.field.maxLength != null &&
            entry.field.maxLength > 0 &&
            entry.field.maxLength <= MAX_TOTP_LENGTH)),
    );
  }

  /**
   * Registration-shaped: a second password/confirm field in the same form, an explicit
   * new-password autocomplete, a new-password qualification, or registration keywords in the
   * form/field identifiers (mirrors AutofillService.isRegistrationPasswordField). Over-refusal is
   * the safe direction — this check only ever shrinks the candidate set.
   */
  private isRegistrationGroup(group: FieldEntry[]): boolean {
    if (group.length >= 2) {
      return true;
    }
    return group.some(
      (entry) =>
        this.autoCompleteIncludes(entry.field, AutoFillConstants.AutocompleteNewPassword) ||
        this.fieldQualifier.isNewPasswordField(entry.field) ||
        this.hasRegistrationKeywords(entry),
    );
  }

  private hasRegistrationKeywords(entry: FieldEntry): boolean {
    const form = entry.field.form ? entry.detail.details?.forms?.[entry.field.form] : undefined;
    const identifiers = [
      form?.htmlID,
      form?.htmlName,
      entry.field.htmlID,
      entry.field.htmlName,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);
    return identifiers.some((value) => {
      const lowered = value.toLowerCase();
      return AutoFillConstants.RegistrationKeywords.some((keyword) => lowered.includes(keyword));
    });
  }

  /** The absolute password rule: an `<input type="password">` and nothing else, ever. */
  private isPasswordTypeInput(field: AutofillField): boolean {
    return field?.tagName?.toLowerCase() === "input" && field.type === "password";
  }

  /** Viewable and not aria-hidden. Hidden fields are never candidates (honeypots). */
  private isConsiderable(field: AutofillField): boolean {
    return field?.viewable === true && field["aria-hidden"] !== true;
  }

  private isConsiderableInput(field: AutofillField): boolean {
    return this.isConsiderable(field) && field?.tagName?.toLowerCase() === "input";
  }

  private autoCompleteIncludes(field: AutofillField, token: string): boolean {
    const autoComplete = field?.autoCompleteType;
    if (!autoComplete) {
      return false;
    }
    return autoComplete
      .toLowerCase()
      .split(/\s+/)
      .some((value) => value === token);
  }

  /**
   * Attribute-level "this is meant to be a password" check, used only to disqualify non-password
   * inputs from other roles — never to qualify a password target.
   */
  private looksLikePasswordAttributes(field: AutofillField): boolean {
    if (field.type === "password") {
      return false;
    }
    const testedValues = [field.htmlID, field.htmlName, field.placeholder];
    return testedValues.some((value) => {
      if (!value) {
        return false;
      }
      const cleaned = value.toLowerCase().replace(/[\s_-]/g, "");
      return (
        cleaned.includes("password") &&
        !AutoFillConstants.PasswordFieldExcludeList.some((excluded) => cleaned.includes(excluded))
      );
    });
  }

  private toSelection(
    role: AgentFillFieldRole,
    entry: FieldEntry,
    tabOrigin: string,
    formClass: AgentFillFormClass,
  ): AgentFillSelection {
    return {
      role,
      opid: entry.field.opid,
      frameId: entry.detail.frameId,
      signature: buildAgentFillFieldSignature(entry.field, entry.detail.frameId),
      target: this.describeTarget(entry.field, formClass),
      frame: entry.detail.frameId === 0 ? "top" : tabOrigin,
      visible: true,
    };
  }

  /** Builds the human-readable target descriptor. Structure only — never a value or label text. */
  private describeTarget(field: AutofillField, formClass: AgentFillFormClass): string {
    const typePart = `[type=${field.type ?? "text"}]`;
    const idPart = field.htmlID
      ? `#${field.htmlID}`
      : field.htmlName
        ? `[name=${field.htmlName}]`
        : "";
    const suffix = field.form && formClass === "login" ? " (login form)" : "";
    return `input${typePart}${idPart}${suffix}`;
  }

  private toCandidates(selections: AgentFillPlan["selections"]): AgentFillCandidate[] {
    const roleOrder: AgentFillFieldRole[] = ["username", "password", "totp"];
    const candidates: AgentFillCandidate[] = [];
    for (const role of roleOrder) {
      const selection = selections[role];
      if (selection) {
        candidates.push({
          role,
          target: selection.target,
          visible: selection.visible,
          frame: selection.frame,
        });
      }
    }
    return candidates;
  }

  private refusalPlan(
    origin: string,
    formClass: AgentFillFormClass,
    refusals: AgentFillPlan["refusals"],
  ): AgentFillPlan {
    const pageRefusal =
      refusals.find((refusal) => refusal.role === "password")?.reason ??
      refusals[0]?.reason ??
      "no-login-form";
    return {
      origin,
      formClass,
      candidates: [],
      refusals: refusals.length > 0 ? refusals : [{ role: "password", reason: "no-login-form" }],
      selections: {},
      pageRefusal,
    };
  }
}
