import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { EMPTY, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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

const ORGANIZATION_ID = "org-1";

function organization(licensed: boolean): Organization {
  return Object.assign(new Organization(), {
    id: ORGANIZATION_ID,
    enabled: true,
    usePam: true,
    accessPam: licensed,
    isProviderUser: false,
  });
}

/** A gated cipher: `partial` is what marks it as governed and still unrevealed. */
function gatedCipher(): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.name = "Prod database";
  cipher.partial = true;
  // The licensing check reads the caller's seat from the cipher's organization.
  cipher.organizationId = ORGANIZATION_ID;
  return cipher;
}

/** Served under a lease: no longer partial, but still PAM-governed. */
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
    licensed?: boolean;
  } = {},
) {
  const {
    state,
    mode = "automatic",
    enabled = true,
    maxDurationSeconds = 4 * 60 * 60,
    licensed = true,
  } = options;
  return moduleMetadata({
    imports: [CipherViewBannerComponent],
    providers: [
      { provide: ConfigService, useValue: { getFeatureFlag$: () => of(enabled) } },
      { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
      {
        provide: OrganizationService,
        useValue: {
          organizations$: () => of([organization(licensed)]),
        },
      },
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

/** The resting state under an auto-approving rule; expanding it collects a duration only. */
export const Privileged: Story = {
  decorators: [pam({ state: () => ({ badgeState: "privileged" }) })],
};

/** Under a human-approval rule, expanding the card collects a window and a justification. */
export const PrivilegedHumanApproval: Story = {
  decorators: [
    pam({
      state: () => ({ badgeState: "privileged" }),
      mode: "human",
      maxDurationSeconds: 24 * 60 * 60,
    }),
  ],
};

/**
 * The caller's organization uses PAM but the caller holds no seat. This card replaces every other
 * state, including an active lease.
 */
export const Unlicensed: Story = {
  decorators: [pam({ state: () => ({ badgeState: "privileged" }), licensed: false })],
};

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

/** A human-approved window that opens later; the granted duration is still its length. */
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

export const ActiveLeaseEndingSoon: Story = {
  args: { cipher: leasedCipher() },
  decorators: [
    pam({
      state: () => ({
        badgeState: { active: { expiresAt: liveFromNow(4 * MINUTE) } },
        activeLease: accessLease({
          notBefore: liveFromNow(-116 * MINUTE),
          notAfter: liveFromNow(4 * MINUTE),
        }),
        extensionsAllowed: true,
      }),
    }),
  ],
};

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

export const FeatureFlagOff: Story = {
  decorators: [pam({ enabled: false, state: () => ({ badgeState: "privileged" }) })],
};

/** Renders nothing rather than an error, like the vault-row badge. */
export const StateReadFails: Story = {
  decorators: [
    moduleMetadata({
      imports: [CipherViewBannerComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: OrganizationService,
          useValue: { organizations$: () => of([organization(true)]) },
        },
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
