import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import type { CipherAccessStateView } from "@bitwarden/sdk-internal";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import { VaultRowLeaseBadgeComponent } from "./vault-row-lease-badge.component";

/** The SDK spells the resting states as bare strings and the active one as a tagged variant. */
type BadgeState = string | { active: { expiresAt: string } };

/** The organization every cipher fixture below belongs to unless a story says otherwise. */
const PAM_ORGANIZATION_ID = "org-1";

/** A cipher the SDK has marked as gated. Only `partial` and `id` decide whether a row fetches. */
function gatedCipher(): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.partial = true;
  cipher.organizationId = PAM_ORGANIZATION_ID;
  return cipher;
}

/** An ordinary vault row — not gated, so the badge never calls the SDK at all. */
function ungatedCipher(): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-2";
  cipher.partial = false;
  cipher.organizationId = PAM_ORGANIZATION_ID;
  return cipher;
}

/**
 * `state` is a factory, not a value, so an active lease's `expiresAt` is relative to when the story
 * renders rather than when this module loaded — a stale one would resolve straight to "Session
 * ended".
 *
 * `organizations` stands in for the account's PAM-eligible organizations, which the component
 * reads to narrow the em dash placeholder to rows whose organization can actually carry access
 * rules. Defaults to the one organization every cipher fixture belongs to; a story can pass an
 * empty `usePam` to show a row the placeholder must not reach.
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

/**
 * A collection row reads the server-derived `hasEnabledAccessRule` straight off the collection, so
 * the resting "Privileged" pill costs no request per row and cannot go stale against the list.
 */
export const CollectionRow: Story = {
  args: { collection: { hasEnabledAccessRule: true } },
  decorators: [pam()],
};

/** An ungoverned collection — and the vault's pseudo-collections, which carry no flag — show nothing. */
export const CollectionRowUngoverned: Story = {
  args: { collection: { hasEnabledAccessRule: false } },
  decorators: [pam()],
};

/** A gated cipher with no request or lease against it yet. */
export const CipherRowPrivileged: Story = {
  args: { cipher: gatedCipher() },
  decorators: [pam({ state: () => "privileged" })],
};

/** A request submitted and awaiting an approver. */
export const CipherRowPending: Story = {
  args: { cipher: gatedCipher() },
  decorators: [pam({ state: () => "pending" })],
};

/** A running lease. The countdown ticks inside the shared badge; the row itself does not poll. */
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

/** An ordinary row: not gated, so no badge and no access-state request. */
export const UngatedCipher: Story = {
  args: { cipher: ungatedCipher() },
  decorators: [pam({ state: () => "privileged" })],
};

/**
 * An ungated row whose organization cannot have access rules. The placeholder narrows to
 * `pamOrganizationIds`, so this row must render nothing, not the em dash `UngatedCipher` shows.
 */
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

/**
 * A failed access-state read resolves to no badge. The badge is decoration on someone else's list,
 * so it fails quiet rather than erroring the row around it.
 */
export const ReadFails: Story = {
  args: { cipher: gatedCipher() },
  decorators: [pam({ fails: true })],
};
