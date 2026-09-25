import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { AccessRefreshService, AccessRequestSdkService } from "@bitwarden/bit-common/pam";
import type { CipherAccessStateView } from "@bitwarden/bit-common/pam";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CardComponent, I18nMockService, TypographyModule } from "@bitwarden/components";

import { ItemDetailsStateBadgeComponent } from "./item-details-state-badge.component";

/** A cipher the server still has gated (`partial`). */
function gatedCipher(name: string): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.name = name;
  cipher.partial = true;
  return cipher;
}

function stateOf(badgeState: unknown, activeLease?: unknown) {
  return {
    provide: AccessRequestSdkService,
    useValue: {
      getCipherAccessState: () =>
        Promise.resolve({ badgeState, activeLease } as unknown as CipherAccessStateView),
    },
  };
}

function activeLeaseEndingIn(ms: number) {
  const notAfter = new Date(Date.now() + ms).toISOString();
  return stateOf({ active: { expiresAt: notAfter } }, { id: "lease-1", notAfter });
}

export default {
  title: "Browser/PAM/Item Details State Badge",
  component: ItemDetailsStateBadgeComponent,
  decorators: [
    moduleMetadata({
      imports: [ItemDetailsStateBadgeComponent, CardComponent, TypographyModule],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } },
        {
          provide: AccessRefreshService,
          useValue: { accessChanged$: () => of<void>(), notifyAccessChanged: () => {} },
        },
        { provide: LogService, useValue: { error: () => {} } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              pamAccessBadgePrivileged: "Privileged",
              pamAccessBadgePending: "Pending approval",
              pamAccessBadgeUnavailable: "Unavailable",
              pamAccessBadgeReady: "Ready to use",
              pamAccessBadgeEnded: "Access ended",
              pamAccessBadgeTimeLeft: (duration) => `${duration} left`,
              pamAccessBadgeEndingSoon: (duration) => `Ending soon • ${duration} left`,
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
  /** The item-details name row at popup width. */
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-w-[380px]">
        <bit-card>
          <div class="tw-flex tw-place-items-center tw-w-full">
            <h2 bitTypography="h4" class="tw-ml-2 tw-mt-2 tw-flex-1 tw-min-w-0 tw-break-all tw-line-clamp-2">
              {{ cipher.name }}
            </h2>
            <app-pam-item-details-state-badge [cipher]="cipher" />
          </div>
        </bit-card>
      </div>
    `,
  }),
} as Meta<ItemDetailsStateBadgeComponent>;

type Story = StoryObj<ItemDetailsStateBadgeComponent>;

/** The resting state on a governed item. */
export const Privileged: Story = {};

/** A request awaiting a decision. This is the longest label, so it sets the worst-case layout. */
export const Pending: Story = {
  decorators: [moduleMetadata({ providers: [stateOf("pending")] })],
};

/** Approved and not yet started. */
export const Ready: Story = {
  decorators: [moduleMetadata({ providers: [stateOf("ready")] })],
};

/** A live lease renders no pill; the cipher-view banner shows its countdown. */
export const ActiveLeaseShowsNoBadge: Story = {
  decorators: [
    moduleMetadata({
      providers: [activeLeaseEndingIn(18 * 60 * 1000)],
    }),
  ],
};

/** An ungoverned item renders nothing. */
export const UngovernedItemShowsNoBadge: Story = {
  args: {
    cipher: Object.assign(gatedCipher("Personal login"), { partial: false }),
  },
};

/** `FeatureFlag.Pam` off renders nothing. */
export const FlagOffShowsNoBadge: Story = {
  decorators: [
    moduleMetadata({
      providers: [{ provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } }],
    }),
  ],
};

/** A long name against the longest label at popup width. */
export const LongNameAtPopupWidth: Story = {
  args: {
    cipher: gatedCipher("Production PostgreSQL primary, eu-west-1, break glass credentials"),
  },
  decorators: [moduleMetadata({ providers: [stateOf("pending")] })],
};
