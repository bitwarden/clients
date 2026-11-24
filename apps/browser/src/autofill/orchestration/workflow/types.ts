import type { Observable } from "rxjs";

import type { AutofillOutcome } from "../../enums/autofill-outcome.enum";
import type { AutoFillOptions } from "../../services/abstractions/autofill.service";
import type { CancellationToken } from "../../utils/cancellation";
import type { TargetSource } from "../enums";
import type { FillOccurred, FillResult } from "../types";

import type {
  FillContext,
  FillRequest,
  FillRequestOf,
  Paged,
  ReadContext,
  SelectContext,
  Selected,
  Targeted,
} from "./context";
import type {
  CipherSource,
  FillEffectKind,
  FillReattempt,
  FillRequestKind,
  LoginChoice,
  PageSource,
  RepromptAction,
} from "./enums";
import type { ActiveTabOptOut } from "./plans";

/** The flags a fill fills with: everything but the tab, the cipher, and the page. */
export type FillFlags = Readonly<Omit<Partial<AutoFillOptions>, "cipher" | "pageDetails" | "tab">>;

/** How the target phase finds the target. */
export type TargetPlan = Readonly<{ source: TargetSource }>;

/** How the read finds the page. */
export type ReadPlan = Readonly<{ source: PageSource }>;

/** How the select phase chooses the cipher. */
export type SelectPlan =
  | Readonly<{ source: typeof CipherSource.Login; choice: LoginChoice }>
  | Readonly<{
      source:
        typeof CipherSource.Card | typeof CipherSource.Identity | typeof CipherSource.FillRequest;
    }>;

/** How the reprompt phase resolves the cipher's master-password reprompt. */
export type RepromptPlan =
  | Readonly<{
      action: typeof RepromptAction.Ask;
      /** Whether a fill the reprompt denies advances its rotation past the cipher. */
      cycleOnDenial: boolean;
    }>
  | Readonly<{ action: typeof RepromptAction.Refuse | typeof RepromptAction.Confirmed }>;

/**
 * How the commit fills: the flags it fills with, and whether it may fill a tab that is not active.
 * Only `plans.ts` can write the opt-out.
 */
export type CommitPlan = Readonly<{
  /**
   * The flags the commit fills with. Whether an untrusted iframe may be filled, and whether the fill
   * submits, come only from here, so every plan states both (see `model.md`, invariant 13).
   */
  flags: FillFlags & Readonly<{ allowUntrustedIframe: boolean; autoSubmitLogin: boolean }>;
}> &
  ActiveTabOptOut;

/**
 * The data that decides a fill: the kind of request it accepts, one sub-plan for each phase, the
 * effects of a fill that filled, and whether an absent fill is re-attempted. Each phase is built
 * from its own sub-plan alone. Plans belong to the orchestration. A caller chooses an entry point,
 * never a plan. See `model.md`.
 *
 * @typeParam Accepts - The kind of request the plan accepts.
 */
export type FillPlan<Accepts extends FillRequestKind = FillRequestKind> = Readonly<{
  /**
   * The kind of request the plan accepts. A request of another kind makes the fill invalid before
   * any phase runs (see `model.md`, invariant 14).
   */
  accepts: Accepts;
  target: TargetPlan;
  read: ReadPlan;
  select: SelectPlan;
  reprompt: RepromptPlan;
  commit: CommitPlan;
  /** The work that follows a commit that filled. Their order is arbitrary. */
  effects: ReadonlySet<FillEffectKind>;
  reattempt: FillReattempt;
}>;

/**
 * What a phase may add to a context: a plain record that holds none of the context's keys, so the
 * context only grows, and no `outcome`, so it is never read as a {@link FillResult}.
 *
 * @typeParam Context - The context the phase reads.
 */
export type Addition<Context extends object> = object & {
  readonly [K in KeysOfUnion<Context>]?: never;
} & { readonly outcome?: never };

/** Every key of every member of a union, where `keyof` gives only the keys they share. */
type KeysOfUnion<T> = T extends unknown ? keyof T : never;

/** What a phase that adds nothing to the context adds. */
export type NoAddition = Readonly<Record<never, never>>;

/**
 * A step of a fill. Its check verifies its preconditions, and its execute acts. See `model.md`.
 *
 * Its members are function-typed properties, not methods, so that a strict type check compares
 * their parameters contravariantly: a phase that reads what no earlier phase added does not fit its
 * slot in {@link FillPhases}. Only the strict pass checks this; a file that opts out of strict
 * checking loses it.
 *
 * @typeParam In - The context the phase reads. A plain record.
 * @typeParam Out - What the phase adds to the context. A plain record.
 */
export interface FillPhase<In extends object, Out extends Addition<In>> {
  /**
   * Verifies the phase's preconditions. Changes nothing, but may wait. The phase executes only when
   * this method returns `undefined`. When a precondition fails, resolves to the result that ends the
   * fill.
   *
   * NOTE: `check` should report `AUTOFILL_CANCELLED` when it exits early due to task cancellation.
   */
  readonly check: (context: In, cancellation: CancellationToken) => Promise<FillResult | undefined>;

  /**
   * Acts. Runs only when the check passed and the token was not cancelled. Resolves to what the
   * phase adds to the context, or to the result that ends the fill.
   */
  readonly execute: (context: In, cancellation: CancellationToken) => Promise<Out | FillResult>;
}

/**
 * The last phase of a fill, which fills the page. Its execute is the point of no return, so it is
 * not given the token.
 *
 * @typeParam In - The context the commit reads.
 */
export interface FillCommit<In extends object> {
  /** Verifies the commit's preconditions, as {@link FillPhase.check} does. */
  readonly check: (context: In, cancellation: CancellationToken) => Promise<FillResult | undefined>;

  /** Fills the page. Resolves to the fill's result. Once it begins, nothing cancels the attempt. */
  readonly execute: (context: In) => Promise<FillResult>;
}

/** The result of a commit that filled. */
export type FillFilled = FillOccurred & { readonly outcome: typeof AutofillOutcome.Filled };

/**
 * Work that follows a commit that filled. It cannot change the fill's result.
 *
 * @typeParam In - The context the effect reads.
 */
export type FillEffect<In extends object> = (context: In, result: FillFilled) => Promise<void>;

/** The phases of a fill, in the order they run. Each reads the request and what earlier phases added. */
export type FillPhases = Readonly<{
  target: FillPhase<FillRequest, Targeted>;
  read: FillPhase<ReadContext, Paged>;
  select: FillPhase<SelectContext, Selected>;
  reprompt: FillPhase<FillContext, NoAddition>;
  commit: FillCommit<FillContext>;
  /** The effects of a commit that filled. Their order is arbitrary. */
  effects: readonly FillEffect<FillContext>[];
}>;

/** How a workflow re-attempts a fill, and where it reports a failed effect. */
export type WorkflowEngineOptions = Readonly<{
  /**
   * When present, an absent fill waits for this to emit, and is then re-attempted once. Each absent
   * fill subscribes anew. A cancelled token, or a completion without an emission, ends the wait, and
   * the fill keeps its absent result. An error rejects the fill in place of the re-attempt. When
   * absent, no fill is re-attempted.
   */
  reattempt$?: Observable<unknown>;
  /** Receives the error of each effect that fails. It must not throw; an error it throws rejects the fill. */
  effectFailed: (error: unknown) => void;
}>;

/**
 * Runs one fill to its result. Rejects when a phase throws, when `effectFailed` throws, or when the
 * re-attempt's wait errors.
 *
 * @typeParam Accepts - The kind of request the workflow accepts. The strict type check alone
 *   enforces it, and the workflow verifies it at runtime regardless.
 */
export type FillWorkflow<Accepts extends FillRequestKind = FillRequestKind> = (
  request: FillRequestOf<Accepts>,
  cancellation: CancellationToken,
) => Promise<FillResult>;
