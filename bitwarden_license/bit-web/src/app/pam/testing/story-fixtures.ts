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
 * Stories build their rows through the real row builders (`toRequestRow`, `toApprovalRow`,
 * `toLeaseRow`) over these, rather than hand-writing row objects: the tabs, the detail route and
 * the approver inbox all render the same grants, and a hand-written row could quietly disagree with
 * what the builders actually produce.
 *
 * Everything is stamped relative to {@link STORY_NOW} rather than the wall clock, so a story's
 * "submitted 30 minutes ago" reads the same on every render and does not drift into a
 * visual-regression diff.
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
 * Some surfaces — the My requests tab, the request detail route, the cipher-view banner — tick their
 * own `Date.now()` signal and compute countdowns from it rather than from a passed-in `now`. A
 * {@link fromNow} window would already have elapsed against the real clock, so those fixtures would
 * render as expired. Call this inside a story's provider factory so it is fresh on every render.
 */
export function liveFromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * A pending access request for a gated cipher. Overrides are applied last and widened through
 * `unknown`, because the SDK brands most of these ids and a fixture that satisfied every brand
 * would be more ceremony than the stories it feeds.
 */
export function accessRequest(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
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
    cipherById: new Map([
      ["cipher-1", cipherView("cipher-1", "Prod database")],
      ["cipher-2", cipherView("cipher-2", "Payments API key")],
      ["cipher-3", cipherView("cipher-3", "Root CA signing key")],
    ]),
    unresolvedCipherName: "Item unavailable",
  };
}

/**
 * A no-op {@link LogService}, as a ready-made provider.
 *
 * Every page-level PAM surface injects one to record the errors it deliberately swallows, and
 * Storybook's root injector has none — so without this a story dies on NG0201 before it renders
 * anything. Silent rather than console-backed: a story that logs on purpose should not look like a
 * story that is broken.
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
 * `app-header` renders the bento switcher, whose `ProductSwitcherService` is `providedIn: "root"`
 * and pulls in organizations, providers, sync, policies and billing state — an entire service graph
 * a page story has no interest in. Overriding the service itself in the root injector short-circuits
 * all of it; the switcher renders empty, which is what a story wants anyway.
 *
 * Must go in `applicationConfig` (the environment injector), not `moduleMetadata` — a
 * `providedIn: "root"` service is not resolved from the module injector.
 */
export function provideStoryProductSwitcher() {
  return {
    provide: ProductSwitcherService,
    useValue: { products$: of({ bento: [], other: [] }) },
  };
}

/**
 * Everything `app-header` needs beyond the product switcher: the account menu reads the active
 * account, whether the vault can be locked, and whether this is a self-hosted install.
 *
 * A page story is about the page, not the chrome around it — these exist so the header renders at
 * all. Root injector, for the same `providedIn: "root"` reason as {@link provideStoryProductSwitcher}.
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
 * Storybook already warns that both strategies are configured (NG0408). With the zone-based
 * scheduler winning, a tick is driven by `NgZone.onMicrotaskEmpty` — but Storybook resolves a
 * story's async work outside the Angular zone, so nothing ever schedules one. Anything that
 * arrives after first paint then never renders: a promise-backed load, or `bit-table` assigning
 * its `rows$` in `ngAfterContentChecked`.
 *
 * Under zoneless, a signal write schedules the tick directly and both cases render. This is scoped
 * to these stories deliberately; changing the shared preview would touch every story in the repo.
 */
export function provideStoryChangeDetection() {
  return provideZonelessChangeDetection();
}
