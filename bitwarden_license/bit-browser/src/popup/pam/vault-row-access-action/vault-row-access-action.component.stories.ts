import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import {
  AccessRefreshService,
  AccessRequestSdkService,
  type CipherAccessStateView,
} from "@bitwarden/bit-common/pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, I18nMockService, ToastService } from "@bitwarden/components";

import { VaultRowAccessStateService } from "../vault-row-access-state/vault-row-access-state.service";

import { VaultRowAccessActionComponent } from "./vault-row-access-action.component";

const ORGANIZATION_ID = "org-1";

/** A cipher the server still has gated (`partial`), owned by a licensed organization. */
function gatedCipher(name: string): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.name = name;
  cipher.partial = true;
  cipher.organizationId = ORGANIZATION_ID;
  return cipher;
}

function organization(overrides: Partial<Organization> = {}): Organization {
  return Object.assign(new Organization(), {
    id: ORGANIZATION_ID,
    enabled: true,
    usePam: true,
    accessPam: true,
    isProviderUser: false,
    ...overrides,
  });
}

function stateOf(badgeState: unknown, fields: Partial<CipherAccessStateView> = {}) {
  return {
    provide: VaultRowAccessStateService,
    useValue: {
      state$: () => of({ badgeState, ...fields } as unknown as CipherAccessStateView),
      invalidate: () => {},
    },
  };
}

function activeFor(ms: number) {
  return { active: { expiresAt: new Date(Date.now() + ms).toISOString() } };
}

export default {
  title: "Browser/PAM/Vault Row Access Action",
  component: VaultRowAccessActionComponent,
  decorators: [
    moduleMetadata({
      imports: [VaultRowAccessActionComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => of([organization()]) } },
        { provide: DialogService, useValue: { open: () => ({ closed: of(undefined) }) } },
        {
          provide: AccessRequestSdkService,
          useValue: { activateAccessRequest: () => Promise.resolve({}) },
        },
        { provide: AccessRefreshService, useValue: { notifyAccessChanged: () => {} } },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: LogService, useValue: { error: () => {} } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              pamRequestAccessButton: "Request access",
              pamRequestAccessShort: "Request",
              pamAccessBadgePending: "Pending approval",
              pamAccessBadgeReady: "Ready to use",
              pamAccessBadgeEnded: "Access ended",
              pamAccessBadgeTimeLeft: (duration) => `${duration} left`,
              pamAccessBadgeEndingSoon: (duration) => `Ending soon • ${duration} left`,
              pamStartLeaseButton: "Start access",
              pamStartLeaseShort: "Start",
              pamStartLeaseSuccess: "Access started.",
              pamStartLeaseError: "Couldn't start access.",
            }),
        },
        stateOf("privileged"),
      ],
    }),
  ],
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
  args: {
    cipher: gatedCipher("Production database"),
  },
  /** A popup vault-list row at popup width: the name truncates, the button never does. */
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-w-[380px] tw-flex tw-items-center tw-gap-1.5 tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-2">
        <span class="tw-truncate tw-flex-1 tw-min-w-0">{{ cipher.name }}</span>
        <app-pam-vault-row-access-action [cipher]="cipher" />
      </div>
    `,
  }),
} as Meta<VaultRowAccessActionComponent>;

type Story = StoryObj<VaultRowAccessActionComponent>;

/** Requestable: the "Request" chip. */
export const Requestable: Story = {};

/** A request awaiting a decision: the pending pill. */
export const Pending: Story = {
  decorators: [moduleMetadata({ providers: [stateOf("pending")] })],
};

/** An approved request not yet started: the "Start" chip. */
export const ReadyToStart: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        stateOf("ready", {
          approvedRequest: { id: "request-1", producedLeaseId: undefined } as never,
        }),
      ],
    }),
  ],
};

/** A live lease: the countdown pill. */
export const Active: Story = {
  decorators: [moduleMetadata({ providers: [stateOf(activeFor(18 * 60 * 1000))] })],
};

/** A lease inside its last five minutes: the escalated countdown pill. */
export const EndingSoon: Story = {
  decorators: [moduleMetadata({ providers: [stateOf(activeFor(3 * 60 * 1000))] })],
};

/** A row's status beside the name: the countdown shortened to its largest unit. */
export const ActiveStatusCompact: Story = {
  decorators: [
    moduleMetadata({ providers: [stateOf(activeFor(3 * 60 * 60 * 1000 + 37 * 60 * 1000))] }),
  ],
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-w-[380px] tw-flex tw-items-center tw-gap-1.5 tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-2">
        <span class="tw-truncate tw-min-w-0">{{ cipher.name }}</span>
        <app-pam-vault-row-access-action [cipher]="cipher" [render]="'status'" />
      </div>
    `,
  }),
};

/** A row's status beside the name inside the last five minutes: compact and escalated. */
export const EndingSoonStatusCompact: Story = {
  ...ActiveStatusCompact,
  decorators: [moduleMetadata({ providers: [stateOf(activeFor(3 * 60 * 1000))] })],
};

/** A lease that lapsed since the row was read: the ended pill until the next read. */
export const Expired: Story = {
  decorators: [moduleMetadata({ providers: [stateOf(activeFor(-60 * 1000))] })],
};

/** An unlicensed member sees nothing, whatever the access state. */
export const Unlicensed: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: OrganizationService,
          useValue: { organizations$: () => of([organization({ accessPam: false })]) },
        },
        stateOf(activeFor(18 * 60 * 1000)),
      ],
    }),
  ],
};

/** A non-gated row renders no button. */
export const UngatedRowShowsNoButton: Story = {
  args: {
    cipher: Object.assign(gatedCipher("Personal login"), { partial: false }),
  },
};

/** `FeatureFlag.Pam` off renders nothing. */
export const FlagOffShowsNoButton: Story = {
  decorators: [
    moduleMetadata({
      providers: [{ provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } }],
    }),
  ],
};

/** A long name against the button at popup row width — the name truncates, not the button. */
export const LongNameAtPopupWidth: Story = {
  args: {
    cipher: gatedCipher("Production PostgreSQL primary, eu-west-1, break glass credentials"),
  },
};
