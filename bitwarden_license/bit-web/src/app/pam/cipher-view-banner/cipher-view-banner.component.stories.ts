import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { EMPTY, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessLeaseSdkService } from "../abstractions/access-lease-sdk.service";
import { AccessRefreshService } from "../abstractions/access-refresh.service";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { LeasingErrorService } from "../abstractions/leasing-error.service";
import { AccessRequestCancelService } from "../services/access-request-cancel.service";
import {
  HOUR,
  MINUTE,
  accessLease,
  accessRequest,
  liveFromNow,
  provideStoryChangeDetection,
  provideStoryLogService,
} from "../testing/story-fixtures";

import { CipherViewBannerComponent } from "./cipher-view-banner.component";

/** A gated cipher: `partial` is what marks it as governed and still unrevealed. */
function gatedCipher(): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.name = "Prod database";
  cipher.partial = true;
  return cipher;
}

/** A cipher already being served under a lease — no longer partial, but still PAM-governed. */
function leasedCipher(): CipherView {
  const cipher = gatedCipher();
  cipher.partial = false;
  (cipher as unknown as { leaseGated: boolean }).leaseGated = true;
  return cipher;
}

type AccessState = Record<string, unknown> | null;

/**
 * The banner ticks its own clock for the lease countdown, so `state` is a factory and its windows
 * are built against the real clock at render time.
 */
function pam(
  options: {
    state?: () => AccessState;
    mode?: "automatic" | "human";
    enabled?: boolean;
    maxDurationSeconds?: number;
  } = {},
) {
  const { state, mode = "automatic", enabled = true, maxDurationSeconds = 4 * 60 * 60 } = options;
  return moduleMetadata({
    imports: [CipherViewBannerComponent],
    providers: [
      { provide: ConfigService, useValue: { getFeatureFlag$: () => of(enabled) } },
      {
        provide: AccessRequestSdkService,
        useValue: {
          getCipherAccessState: () => Promise.resolve(state?.() ?? null),
          preCheck: () =>
            Promise.resolve({
              approvalMode: mode,
              hasActiveLease: false,
              maxDurationSeconds,
              defaultDurationSeconds: 60 * 60,
            }),
          submitAccessRequest: () => Promise.resolve({}),
          activateAccessRequest: () => Promise.resolve({}),
        },
      },
      {
        provide: AccessLeaseSdkService,
        useValue: { extendLease: () => Promise.resolve({}), endLease: () => Promise.resolve() },
      },
      {
        provide: AccessRefreshService,
        useValue: { accessChanged$: () => EMPTY, notifyAccessChanged: () => {} },
      },
      {
        provide: AccessRequestCancelService,
        useValue: { cancelOutstandingRequest: () => Promise.resolve() },
      },
      { provide: LeasingErrorService, useValue: { isLeasingError: () => false } },
      {
        provide: DialogService,
        useValue: {
          openSimpleDialog: () => Promise.resolve(false),
          open: () => ({ closed: of(undefined) }),
        },
      },
      { provide: ToastService, useValue: { showToast: () => {} } },
    ],
  });
}

export default {
  title: "Web/PAM/Cipher View Banner",
  component: CipherViewBannerComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideStoryLogService(),
      ],
    }),
  ],
  args: { cipher: gatedCipher() },
} as Meta<CipherViewBannerComponent>;

type Story = StoryObj<CipherViewBannerComponent>;

/**
 * The resting state under an auto-approving rule: the card carries the rule's cap and the
 * instant-approval clause, and expanding it collects a duration only.
 */
export const Privileged: Story = {
  decorators: [pam({ state: () => ({ badgeState: "privileged" }) })],
};

/**
 * The same entry point against a rule that requires human approval: the card carries the cap
 * alone, and expanding it collects a window plus a justification.
 */
export const PrivilegedHumanApproval: Story = {
  decorators: [
    pam({
      state: () => ({ badgeState: "privileged" }),
      mode: "human",
      maxDurationSeconds: 24 * 60 * 60,
    }),
  ],
};

/** A request is with an approver. Request access is not offered again; the request can be cancelled. */
export const PendingRequest: Story = {
  decorators: [
    pam({
      state: () => ({
        badgeState: "pending",
        pendingRequest: accessRequest({
          leaseNotBefore: liveFromNow(0),
          leaseNotAfter: liveFromNow(HOUR),
        }),
      }),
    }),
  ],
};

/** Approved but not yet activated — the requester still has to start the lease. */
export const ApprovedReadyToStart: Story = {
  decorators: [
    pam({
      state: () => ({
        badgeState: "ready",
        approvedRequest: accessRequest({
          status: "approved",
          leaseNotBefore: liveFromNow(0),
          leaseNotAfter: liveFromNow(2 * HOUR),
        }),
      }),
    }),
  ],
};

/**
 * The same state reached the other way: a human approver approved a window the requester chose,
 * which can open in the future. The granted duration is the window's length either way.
 */
export const ApprovedByApprover: Story = {
  decorators: [
    pam({
      mode: "human",
      state: () => ({
        badgeState: "ready",
        approvedRequest: accessRequest({
          status: "approved",
          leaseNotBefore: liveFromNow(20 * HOUR),
          leaseNotAfter: liveFromNow(23 * HOUR),
        }),
      }),
    }),
  ],
};

/** A running lease, with the countdown ticking and the rule allowing extensions. */
export const ActiveLease: Story = {
  args: { cipher: leasedCipher() },
  decorators: [
    pam({
      state: () => ({
        badgeState: { active: { expiresAt: liveFromNow(90 * MINUTE) } },
        activeLease: accessLease({
          notBefore: liveFromNow(-30 * MINUTE),
          notAfter: liveFromNow(90 * MINUTE),
        }),
        extensionsAllowed: true,
      }),
    }),
  ],
};

/** The same lease under a rule that does not allow extensions — only End access is offered. */
export const ActiveLeaseNoExtensions: Story = {
  args: { cipher: leasedCipher() },
  decorators: [
    pam({
      state: () => ({
        badgeState: { active: { expiresAt: liveFromNow(20 * MINUTE) } },
        activeLease: accessLease({
          notBefore: liveFromNow(-40 * MINUTE),
          notAfter: liveFromNow(20 * MINUTE),
        }),
        extensionsAllowed: false,
      }),
    }),
  ],
};

/** With the PAM flag off the banner renders nothing, whatever the cipher is. */
export const FeatureFlagOff: Story = {
  decorators: [pam({ enabled: false, state: () => ({ badgeState: "privileged" }) })],
};

/**
 * A gated cipher whose access state could not be read. The banner renders nothing rather than an
 * error — the cipher view behind it is still useful, and the vault-row badge fails the same way.
 */
export const StateReadFails: Story = {
  decorators: [
    moduleMetadata({
      imports: [CipherViewBannerComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } },
        {
          provide: AccessRequestSdkService,
          useValue: { getCipherAccessState: () => Promise.reject(new Error("read failed")) },
        },
        { provide: AccessLeaseSdkService, useValue: {} },
        {
          provide: AccessRefreshService,
          useValue: { accessChanged$: () => EMPTY, notifyAccessChanged: () => {} },
        },
        { provide: AccessRequestCancelService, useValue: {} },
        { provide: LeasingErrorService, useValue: { isLeasingError: () => false } },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
        { provide: ToastService, useValue: { showToast: () => {} } },
      ],
    }),
  ],
};
