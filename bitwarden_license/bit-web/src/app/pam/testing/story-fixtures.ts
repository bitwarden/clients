import { provideZonelessChangeDetection } from "@angular/core";
import { of } from "rxjs";

import { LockService, LogoutService } from "@bitwarden/auth/common";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ProductSwitcherService } from "@bitwarden/web-vault/app/layouts/product-switcher/shared/product-switcher.service";

import type {
  AccessLeaseView,
  AccessRequestDecisionView,
  AccessRequestView,
} from "../abstractions/access-lease";
import type { ResolvedNames } from "../access-requests/access-name-resolver.service";

/**
 * Shared fixtures for the PAM page-level stories.
 *
 * Stories build rows through the real row builders (`toRequestRow`, `toApprovalRow`,
 * `toLeaseRow`), since a hand-written row could quietly disagree with what the builders produce.
 *
 * Everything is stamped relative to {@link STORY_NOW}, not the wall clock, so timestamps don't
 * drift into a visual-regression diff.
 */
export const STORY_NOW = new Date("2026-08-17T12:00:00.000Z");

/**
 * Milliseconds offset from {@link STORY_NOW}, as an ISO string. Use for anything whose label is
 * computed by a builder that takes `now` as an argument (`toApprovalRow`, `toRequestRow`), where a
 * fixed clock keeps the rendered text stable.
 */
export function fromNow(ms: number): string {
  return new Date(STORY_NOW.getTime() + ms).toISOString();
}

/**
 * Milliseconds offset from the REAL clock, evaluated when called.
 *
 * Some surfaces tick their own `Date.now()` signal rather than a passed-in `now`, so a
 * {@link fromNow} window would already read as expired against the real clock. Call inside a
 * story's provider factory so it stays fresh on every render.
 */
export function liveFromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * A pending access request for a gated cipher. Overrides widen through `unknown`, since the SDK
 * brands most of these ids and a fully-branded fixture isn't worth the ceremony.
 */
export function accessRequest(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "user-1",
    requesterName: "Grace Hopper",
    requesterEmail: "grace@example.com",
    status: "pending",
    submittedAt: fromNow(-30 * MINUTE),
    resolvedAt: undefined,
    leaseNotBefore: fromNow(0),
    leaseNotAfter: fromNow(HOUR),
    reason: "Investigating the checkout latency spike.",
    decisions: [],
    producedLeaseId: undefined,
    producedLeaseStatus: undefined,
    extensionOfLeaseId: undefined,
    ...overrides,
  } as unknown as AccessRequestView;
}

/** An active lease the caller holds. */
export function accessLease(overrides: Record<string, unknown> = {}): AccessLeaseView {
  return {
    id: "lease-1",
    requestId: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    status: "active",
    notBefore: fromNow(-15 * MINUTE),
    notAfter: fromNow(45 * MINUTE),
    termination: undefined,
    ...overrides,
  } as unknown as AccessLeaseView;
}

/** A recorded human decision, for the resolver column and the approver comment. */
export function decision(overrides: Record<string, unknown> = {}): AccessRequestDecisionView {
  return {
    decider: { human: { id: "approver-1", name: "Ada Lovelace", email: "ada@example.com" } },
    verdict: "approve",
    comment: undefined,
    decidedAt: fromNow(-20 * MINUTE),
    ...overrides,
  } as unknown as AccessRequestDecisionView;
}

/** A decrypted cipher, so rows that resolve one render their favicon rather than a blank. */
function cipherView(id: string, name: string): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = name;
  return cipher;
}

/**
 * Name lookups covering the fixture ids above. Ids absent here are exactly the "not in the caller's
 * local vault" case the row builders fall back on, so a story can drop an entry to exercise it.
 */
export function storyNames(): ResolvedNames {
  return {
    cipherNameById: new Map([
      ["cipher-1", "Prod database"],
      ["cipher-2", "Payments API key"],
      ["cipher-3", "Root CA signing key"],
    ]),
    collectionNameById: new Map([
      ["col-1", "Production"],
      ["col-2", "Payments"],
    ]),
    organizationNameById: new Map([["org-1", "Meridian Group"]]),
    cipherById: new Map([
      ["cipher-1", cipherView("cipher-1", "Prod database")],
      ["cipher-2", cipherView("cipher-2", "Payments API key")],
      ["cipher-3", cipherView("cipher-3", "Root CA signing key")],
    ]),
  };
}

/**
 * A no-op {@link LogService}, as a ready-made provider.
 *
 * Every page-level PAM surface injects one to record swallowed errors; Storybook's root injector
 * has none, so without this a story dies on NG0201. Silent, not console-backed, so a story
 * logging on purpose doesn't look broken.
 */
export function provideStoryLogService() {
  const noop = () => {};
  return {
    provide: LogService,
    useValue: {
      debug: noop,
      info: noop,
      warning: noop,
      error: noop,
      write: noop,
      measure: () => ({}) as PerformanceMeasure,
      mark: () => ({}) as PerformanceMark,
    } satisfies LogService,
  };
}

/**
 * A stub for the web header's product switcher.
 *
 * `ProductSwitcherService` is `providedIn: "root"` and pulls in an entire service graph a page
 * story has no interest in; overriding it in the root injector short-circuits all of it, and the
 * switcher renders empty, which is what a story wants.
 *
 * Must go in `applicationConfig`, not `moduleMetadata` — a root service isn't resolved from the
 * module injector.
 */
export function provideStoryProductSwitcher() {
  return {
    provide: ProductSwitcherService,
    useValue: { products$: of({ bento: [], other: [] }) },
  };
}

/**
 * Everything `app-header` needs beyond the product switcher: active account, lock state, and
 * self-hosted status.
 *
 * A page story is about the page, not the chrome; these just let the header render. Root
 * injector, same reason as {@link provideStoryProductSwitcher}.
 */
export function provideStoryWebHeader() {
  return [
    provideStoryProductSwitcher(),
    { provide: PlatformUtilsService, useValue: { isSelfHost: () => false } },
    {
      provide: VaultTimeoutSettingsService,
      useValue: { availableVaultTimeoutActions$: () => of([]) },
    },
    { provide: LogoutService, useValue: { logout: () => Promise.resolve() } },
    { provide: LockService, useValue: { lock: () => Promise.resolve() } },
  ];
}

/**
 * Zoneless change detection, overriding the zone-based provider in `.storybook/preview.tsx`.
 *
 * Storybook resolves a story's async work outside the Angular zone, so the zone-based scheduler's
 * `NgZone.onMicrotaskEmpty` tick never fires for work arriving after first paint. Zoneless
 * schedules the tick directly off a signal write instead.
 *
 * Scoped to these stories deliberately; the shared preview affects every story in the repo.
 */
export function provideStoryChangeDetection() {
  return provideZonelessChangeDetection();
}
