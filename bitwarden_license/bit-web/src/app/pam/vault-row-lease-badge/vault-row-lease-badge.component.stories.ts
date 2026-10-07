import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { EMPTY, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import type { CipherAccessStateView } from "@bitwarden/sdk-internal";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessRefreshService } from "../abstractions/access-refresh.service";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import { VaultRowLeaseBadgeComponent } from "./vault-row-lease-badge.component";

type BadgeState = string | { active: { expiresAt: string } };

const PAM_ORGANIZATION_ID = "org-1";

/** Only `partial` and `id` decide whether a row fetches. */
function gatedCipher(): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.partial = true;
  cipher.organizationId = PAM_ORGANIZATION_ID;
  return cipher;
}

function ungatedCipher(): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-2";
  cipher.partial = false;
  cipher.organizationId = PAM_ORGANIZATION_ID;
  return cipher;
}

/**
 * `state` is a factory so an active lease's `expiresAt` is relative to render time; one built at
 * module load could already read "Access ended". `organizations` decides which rows may draw the
 * em dash.
 */
function pam(
  options: {
    enabled?: boolean;
    state?: () => BadgeState;
    fails?: boolean;
    organizations?: { id: string; usePam: boolean }[];
  } = {},
) {
  const {
    enabled = true,
    state,
    fails = false,
    organizations = [{ id: PAM_ORGANIZATION_ID, usePam: true }],
  } = options;
  return moduleMetadata({
    imports: [VaultRowLeaseBadgeComponent],
    providers: [
      { provide: ConfigService, useValue: { getFeatureFlag$: () => of(enabled) } },
      {
        provide: AccessRequestSdkService,
        useValue: {
          getCipherAccessState: () =>
            fails
              ? Promise.reject(new Error("access-state read failed"))
              : Promise.resolve({ badgeState: state?.() } as unknown as CipherAccessStateView),
        },
      },
      { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
      {
        provide: AccessRefreshService,
        useValue: { accessChanged$: () => EMPTY, notifyAccessChanged: () => {} },
      },
      {
        provide: OrganizationService,
        useValue: {
          organizations$: () => of(organizations as Organization[]),
        },
      },
    ],
  });
}

export default {
  title: "Web/PAM/Vault Row Lease Badge",
  component: VaultRowLeaseBadgeComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<VaultRowLeaseBadgeComponent>;

type Story = StoryObj<VaultRowLeaseBadgeComponent>;

/** Read straight off `hasEnabledAccessRule`, so the pill costs no request per row. */
export const CollectionRow: Story = {
  args: { collection: { hasEnabledAccessRule: true } },
  decorators: [pam()],
};

/** Shows nothing, as do the vault's pseudo-collections, which carry no flag. */
export const CollectionRowUngoverned: Story = {
  args: { collection: { hasEnabledAccessRule: false } },
  decorators: [pam()],
};

/** A gated cipher with no request or lease against it yet. */
export const CipherRowPrivileged: Story = {
  args: { cipher: gatedCipher() },
  decorators: [pam({ state: () => "privileged" })],
};

export const CipherRowPending: Story = {
  args: { cipher: gatedCipher() },
  decorators: [pam({ state: () => "pending" })],
};

export const CipherRowActiveLease: Story = {
  args: { cipher: gatedCipher() },
  decorators: [
    pam({
      state: () => ({
        active: { expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() },
      }),
    }),
  ],
};

/** Not gated, so no access-state request; the em dash marks it as checked. */
export const UngatedCipher: Story = {
  args: { cipher: ungatedCipher() },
  decorators: [pam({ state: () => "privileged" })],
};

/** Renders nothing, not the em dash, since the row's organization does not use PAM. */
export const UngatedCipherInNonPamOrganization: Story = {
  args: { cipher: ungatedCipher() },
  decorators: [
    pam({ state: () => "privileged", organizations: [{ id: PAM_ORGANIZATION_ID, usePam: false }] }),
  ],
};

/** With the PAM flag off nothing renders, and no row issues a request. */
export const FeatureFlagOff: Story = {
  args: { cipher: gatedCipher() },
  decorators: [pam({ enabled: false, state: () => "privileged" })],
};

/** A failed read renders nothing, since the badge is decoration and should fail quietly. */
export const ReadFails: Story = {
  args: { cipher: gatedCipher() },
  decorators: [pam({ fails: true })],
};
