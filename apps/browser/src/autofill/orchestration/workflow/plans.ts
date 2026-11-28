import { TargetSource } from "../enums";

import {
  CipherSource,
  FillEffectKind,
  FillReattempt,
  FillRequestKind,
  LoginChoice,
  PageSource,
  RepromptAction,
} from "./enums";
import type { CommitPlan, FillPlan } from "./types";

type CommitFlags = CommitPlan["flags"];

/**
 * Key of the active-tab opt-out in a `FillPlan`'s commit sub-plan. `true` under it allows the commit
 * to fill a tab that is not the active tab. Code outside this file cannot write it, though a copy of
 * a sub-plan that has it keeps it; no plan is built outside the orchestration (see `model.md`,
 * invariant 10). A sub-plan without the key requires the active tab.
 *
 * DANGER: The opt-out exists only to support extension-initiated fills. Set it to `true` only for a
 * fill the extension initiates. Write it as a literal on each plan that opts out; never derive a
 * plan from one that opts out.
 */
const allowInactiveTab = Symbol("workflow.allowInactiveTab");

/**
 * A commit sub-plan's active-tab opt-out. Only this file can write it, and a copy of a sub-plan that
 * has it keeps it. A sub-plan without it requires the active tab.
 */
export type ActiveTabOptOut = Readonly<{ [allowInactiveTab]?: true }>;

/**
 * Whether a plan's commit may fill a tab that is not the active tab. Only `true` under the
 * file-private key allows it; anything else, including no key, requires the active tab.
 */
export function commitAllowsInactiveTab(commit: ActiveTabOptOut): boolean {
  return commit[allowInactiveTab] === true;
}

/** The flags of an eager fill: it fills only empty fields, in trusted frames. */
const EAGER_FLAGS: CommitFlags = Object.freeze({
  skipLastUsed: true,
  skipUsernameOnlyFill: true,
  onlyEmptyFields: true,
  fillNewPassword: false,
  allowUntrustedIframe: false,
  allowTotpAutofill: false,
  autoSubmitLogin: false,
});

/** The flags of a login fill the user commands. */
const COMMAND_FLAGS: CommitFlags = Object.freeze({
  skipLastUsed: false,
  skipUsernameOnlyFill: false,
  onlyEmptyFields: false,
  fillNewPassword: true,
  allowUntrustedIframe: true,
  allowTotpAutofill: true,
  autoSubmitLogin: false,
});

/** The flags of a card or identity fill the user commands. */
const CIPHER_TYPE_FLAGS: CommitFlags = Object.freeze({
  skipLastUsed: false,
  skipUsernameOnlyFill: false,
  onlyEmptyFields: false,
  fillNewPassword: false,
  allowUntrustedIframe: true,
  allowTotpAutofill: false,
  autoSubmitLogin: false,
});

/**
 * The flags of a fill of a cipher the request carries. The caller may override all but
 * `allowUntrustedIframe` and `autoSubmitLogin` (see `model.md`, invariant 13).
 */
const REQUESTED_CIPHER_FLAGS: CommitFlags = Object.freeze({
  fillNewPassword: true,
  allowTotpAutofill: true,
  allowUntrustedIframe: true,
  autoSubmitLogin: false,
});

/** A reprompt that asks the user, and cycles past the cipher it denies. */
const ASK_AND_CYCLE = { action: RepromptAction.Ask, cycleOnDenial: true } as const;

/**
 * A reprompt that asks the user, and cycles nothing.
 */
const ASK = { action: RepromptAction.Ask, cycleOnDenial: false } as const;

/** Freezes a plan and each of its sub-plans. */
function frozen<Accepts extends FillRequestKind>(plan: FillPlan<Accepts>): FillPlan<Accepts> {
  for (const part of Object.values(plan)) {
    if (part && typeof part === "object" && !(part instanceof Set)) {
      Object.freeze(part);
    }
  }
  return Object.freeze(plan);
}

/**
 * The plans of the fills the orchestration runs, one for each entry point. See `model.md`.
 *
 * The effects a plan lists run in an arbitrary order. An effect that must run before or after another
 * is a phase.
 */
export const FillPlans = Object.freeze({
  /** An eager fill: one requested in response to a transition report, without the user acting. */
  eager: frozen({
    accepts: FillRequestKind.Reported,
    target: { source: TargetSource.Reported },
    read: { source: PageSource.Collect },
    select: { source: CipherSource.Login, choice: LoginChoice.ForEagerFill },
    reprompt: { action: RepromptAction.Refuse },
    commit: { flags: EAGER_FLAGS },
    effects: new Set([
      FillEffectKind.RecordActivity,
      FillEffectKind.CopyTotp,
      FillEffectKind.RefreshOverlay,
    ]),
    reattempt: FillReattempt.SlowRender,
  }),

  /** A login fill the user commands with the keyboard shortcut. */
  command: frozen({
    accepts: FillRequestKind.Tab,
    target: { source: TargetSource.User },
    read: { source: PageSource.Collect },
    select: { source: CipherSource.Login, choice: LoginChoice.Next },
    reprompt: ASK_AND_CYCLE,
    commit: { flags: COMMAND_FLAGS },
    effects: new Set([
      FillEffectKind.RecordActivity,
      FillEffectKind.Cycle,
      FillEffectKind.CopyTotp,
      FillEffectKind.RefreshOverlay,
    ]),
    reattempt: FillReattempt.None,
  }),

  /** A login fill the user commands by its cipher type. */
  loginType: frozen({
    accepts: FillRequestKind.Tab,
    target: { source: TargetSource.User },
    read: { source: PageSource.Collect },
    select: { source: CipherSource.Login, choice: LoginChoice.Next },
    reprompt: ASK_AND_CYCLE,
    commit: { flags: COMMAND_FLAGS },
    effects: new Set([FillEffectKind.RecordActivity, FillEffectKind.Cycle]),
    reattempt: FillReattempt.None,
  }),

  /** A card fill the user commands. */
  card: frozen({
    accepts: FillRequestKind.Tab,
    target: { source: TargetSource.User },
    read: { source: PageSource.Collect },
    select: { source: CipherSource.Card },
    reprompt: ASK_AND_CYCLE,
    commit: { flags: CIPHER_TYPE_FLAGS },
    effects: new Set([FillEffectKind.RecordActivity, FillEffectKind.Cycle]),
    reattempt: FillReattempt.None,
  }),

  /** An identity fill the user commands. */
  identity: frozen({
    accepts: FillRequestKind.Tab,
    target: { source: TargetSource.User },
    read: { source: PageSource.Collect },
    select: { source: CipherSource.Identity },
    reprompt: ASK_AND_CYCLE,
    commit: { flags: CIPHER_TYPE_FLAGS },
    effects: new Set([FillEffectKind.RecordActivity, FillEffectKind.Cycle]),
    reattempt: FillReattempt.None,
  }),

  /** A step of the auto-submit workflow a policy starts. It fills, and then submits. */
  autoSubmit: frozen({
    accepts: FillRequestKind.Tab,
    target: { source: TargetSource.Policy },
    read: { source: PageSource.Collect },
    select: { source: CipherSource.Login, choice: LoginChoice.Recent },
    reprompt: ASK,
    commit: {
      flags: Object.freeze({
        fillNewPassword: true,
        allowUntrustedIframe: true,
        allowTotpAutofill: true,
        autoSubmitLogin: true,
      }),
    },
    effects: new Set([FillEffectKind.RecordActivity]),
    reattempt: FillReattempt.None,
  }),

  /** A fill of the cipher the user chose from the context menu. */
  contextMenu: frozen({
    accepts: FillRequestKind.Cipher,
    target: { source: TargetSource.User },
    read: { source: PageSource.Collect },
    select: { source: CipherSource.FillRequest },
    reprompt: ASK,
    commit: { flags: REQUESTED_CIPHER_FLAGS },
    effects: new Set([FillEffectKind.RecordActivity]),
    reattempt: FillReattempt.None,
  }),

  /**
   * A fill of the cipher the user chose in the popup. The popup has focus, so its target is not the
   * active tab; the extension initiates this fill. The popup confirms the reprompt before it requests
   * the fill, and the reprompt that the other plans ask for re-enters here once the user confirms it.
   */
  popup: frozen({
    accepts: FillRequestKind.Cipher,
    target: { source: TargetSource.User },
    read: { source: PageSource.Collect },
    select: { source: CipherSource.FillRequest },
    reprompt: { action: RepromptAction.Confirmed },
    commit: { flags: REQUESTED_CIPHER_FLAGS, [allowInactiveTab]: true },
    effects: new Set([FillEffectKind.RecordActivity]),
    reattempt: FillReattempt.None,
  }),

  /**
   * A fill of the cipher the user chose in the inline menu. It collects its page under its own lease,
   * and fills the fields its request allows. Its sub-plans are the context menu's; it is a plan of its
   * own because it is an entry point of its own (see `model.md`, invariant 10).
   */
  inlineMenu: frozen({
    accepts: FillRequestKind.Cipher,
    target: { source: TargetSource.User },
    read: { source: PageSource.Collect },
    select: { source: CipherSource.FillRequest },
    reprompt: ASK,
    commit: { flags: REQUESTED_CIPHER_FLAGS },
    effects: new Set([FillEffectKind.RecordActivity]),
    reattempt: FillReattempt.None,
  }),

  /**
   * A fill of a cipher that is not saved in the vault, such as the inline menu's generated password,
   * into the page details its request carries. It collects nothing. Such a cipher requires no
   * reprompt, so one that does is refused.
   */
  unsavedCipher: frozen({
    accepts: FillRequestKind.Page,
    target: { source: TargetSource.User },
    read: { source: PageSource.FillRequest },
    select: { source: CipherSource.FillRequest },
    reprompt: { action: RepromptAction.Refuse },
    commit: { flags: REQUESTED_CIPHER_FLAGS },
    effects: new Set([FillEffectKind.RecordActivity]),
    reattempt: FillReattempt.None,
  }),
} as const);
