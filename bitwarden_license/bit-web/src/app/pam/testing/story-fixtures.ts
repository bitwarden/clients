import { provideZonelessChangeDetection } from "@angular/core";
import { of } from "rxjs";

import { LogoutService } from "@bitwarden/auth/common";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Measurement } from "@bitwarden/logging";
import { LockService } from "@bitwarden/unlock";
import { ProductSwitcherService } from "@bitwarden/web-vault/app/layouts/product-switcher/shared/product-switcher.service";

import type {
  AccessLeaseView,
  AccessRequestDecisionView,
  AccessRequestView,
} from "../abstractions/access-lease";
import type { ResolvedNames } from "../access-requests/access-name-resolver.service";

/**
 * Fixed, so story timestamps don't drift into a visual-regression diff. Build rows through the real
 * row builders, since a hand-written row can disagree with them.
 */
export const STORY_NOW = new Date("2026-08-17T12:00:00.000Z");

/** An offset from {@link STORY_NOW}, for labels built by a builder that takes `now`. */
export function fromNow(ms: number): string {
  return new Date(STORY_NOW.getTime() + ms).toISOString();
}

/**
 * An offset from the real clock, for surfaces that tick their own `Date.now()`. Call inside a
 * story's provider factory so it stays fresh on every render.
 */
export function liveFromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** A pending request. Overrides widen through `unknown`, since the SDK brands most of these ids. */
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

/** Drop an entry to exercise the row builders' not-in-local-vault fallback. */
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
 * Storybook's root injector has no {@link LogService}, so a PAM story dies on NG0201 without this.
 * Silent, so a story whose logging is expected doesn't look broken.
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
      enableRecorder: noop,
      measure: () => ({}) as PerformanceMeasure,
      mark: () => ({}) as PerformanceMark,
      startMeasurement: () => new Measurement(() => ({}) as PerformanceMeasure),
    } satisfies LogService,
  };
}

/**
 * Stubs the root `ProductSwitcherService` and its service graph. Must go in `applicationConfig`,
 * since a root service isn't resolved from the module injector.
 */
export function provideStoryProductSwitcher() {
  return {
    provide: ProductSwitcherService,
    useValue: { products$: of({ bento: [], other: [] }) },
  };
}

/** What `app-header` needs beyond the product switcher, also at the root injector. */
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
 * Overrides the preview's zone-based scheduler, since Storybook resolves async work outside the
 * zone and its tick never fires after first paint. Scoped to these stories, not the shared preview.
 */
export function provideStoryChangeDetection() {
  return provideZonelessChangeDetection();
}
