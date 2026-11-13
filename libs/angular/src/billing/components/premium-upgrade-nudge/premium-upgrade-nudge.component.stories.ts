import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { action } from "storybook/actions";

import { ClientType } from "@bitwarden/client-type";
import { PremiumUpgradeNudgeOptions } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadenceIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef, I18nMockService } from "@bitwarden/components";

import {
  PremiumUpgradeNudgeComponent,
  PremiumUpgradeNudgeDialogData,
} from "./premium-upgrade-nudge.component";

type Story = StoryObj<PremiumUpgradeNudgeComponent>;

type ContentSet = {
  options: PremiumUpgradeNudgeOptions;
  messages: Record<string, string>;
};

const premiumTier = (annualPrice?: number): PersonalSubscriptionPricingTier => ({
  id: PersonalSubscriptionPricingTierIds.Premium,
  name: "Premium",
  description: "Complete online security",
  availableCadences: [SubscriptionCadenceIds.Annually],
  passwordManager: {
    type: "standalone",
    annualPrice,
    annualPricePerAdditionalStorageGB: 4,
    providedStorageGB: 1,
    features: [],
  },
});

const sharedMessages: Record<string, string> = {
  premium: "Premium",
  upgradeToPremium: "Upgrade to Premium",
  close: "Close",
  month: "month",
  cancelAnytime: "Cancel anytime",
  secureCheckoutViaStripe: "Secure checkout via Stripe",
  notNow: "Not now",
};

const nudgeStory = ({
  content,
  client,
  selfHosted = false,
}: {
  content: ContentSet;
  client: ClientType;
  selfHosted?: boolean;
}): Story => {
  const data: PremiumUpgradeNudgeDialogData = {
    options: content.options,
    upgrade: () => {
      action("upgrade")();
      return new Promise((resolve) => setTimeout(resolve, 1500));
    },
  };

  return {
    parameters: client === ClientType.Browser ? { chromatic: { viewports: [380] } } : undefined,
    decorators: [
      moduleMetadata({
        providers: [
          { provide: DIALOG_DATA, useValue: data },
          {
            provide: DialogRef,
            useValue: {
              close: action("DialogRef.close"),
              disableClose: client === ClientType.Browser,
            },
          },
          {
            provide: I18nService,
            useFactory: () => new I18nMockService({ ...sharedMessages, ...content.messages }),
          },
          {
            provide: PlatformUtilsService,
            useValue: { getClientType: () => client },
          },
          {
            provide: SubscriptionPricingServiceAbstraction,
            useValue: {
              getPremiumSubscriptionPricingTier$: () =>
                of(premiumTier(selfHosted ? undefined : 19.8)),
            },
          },
        ],
      }),
    ],
  };
};

const dark = (story: Story): Story => ({ ...story, globals: { theme: "dark" } });

const totp: ContentSet = {
  options: {
    titleKey: "totpNudgeTitle",
    descriptionKey: "totpNudgeDescription",
    image: "totp",
  },
  messages: {
    totpNudgeTitle: "Log in faster with built-in codes",
    totpNudgeDescription:
      "Premium adds TOTP verification codes to logins in your vault. No separate authenticator app needed.",
  },
};

const fileSendExtension: ContentSet = {
  options: { titleKey: "fileSendNudgeTitle", descriptionKey: "fileSendNudgeDescription" },
  messages: {
    fileSendNudgeTitle: "Send files without the risk",
    fileSendNudgeDescription:
      "Send files like tax returns, contracts, and IDs securely — and skip the risky email attachments.",
  },
};

const fileSendWebDesktop: ContentSet = {
  options: {
    titleKey: "fileSendNudgeTitle",
    descriptionKey: "fileSendNudgeDescription",
    unlockedFeatureKeys: [
      "fileSendNudgeEncrypted",
      "fileSendNudgeExpiringLinks",
      "fileSendNudgeFileSize",
    ],
  },
  messages: {
    fileSendNudgeTitle: "Send sensitive files without the risk",
    fileSendNudgeDescription:
      "Send files like tax returns, contracts, and IDs securely — and skip the risky email attachments.",
    fileSendNudgeEncrypted: "End-to-end encrypted",
    fileSendNudgeExpiringLinks: "Auto-expiring links",
    fileSendNudgeFileSize: "Send files up to 500 MB",
  },
};

const attachmentsExtension: ContentSet = {
  options: { titleKey: "attachmentsNudgeTitle", descriptionKey: "attachmentsNudgeDescription" },
  messages: {
    attachmentsNudgeTitle: "Store sensitive documents safely",
    attachmentsNudgeDescription:
      "Store passports, IDs, digital receipts, and more in your vault with encryption.",
  },
};

const attachmentsWebDesktop: ContentSet = {
  options: {
    titleKey: "attachmentsNudgeTitle",
    descriptionKey: "attachmentsNudgeDescription",
    unlockedFeatureKeys: [
      "attachmentsNudgePassports",
      "attachmentsNudgeReceipts",
      "attachmentsNudgeTaxForms",
    ],
  },
  messages: {
    attachmentsNudgeTitle: "Store sensitive documents safely",
    attachmentsNudgeDescription:
      "Upload and attach your important documents to items in your vault.",
    attachmentsNudgePassports: "Passports and other IDs",
    attachmentsNudgeReceipts: "Digital receipts",
    attachmentsNudgeTaxForms: "Tax forms",
  },
};

const archive: ContentSet = {
  options: { titleKey: "archiveNudgeTitle", descriptionKey: "archiveNudgeDescription" },
  messages: {
    archiveNudgeTitle: "Declutter your vault with Archive",
    archiveNudgeDescription:
      "Tuck away items you don't want to see in search results or autofill suggestions without losing them forever.",
  },
};

const twoFactorSetup: ContentSet = {
  options: { titleKey: "twoFactorNudgeTitle", descriptionKey: "twoFactorNudgeDescription" },
  messages: {
    twoFactorNudgeTitle: "Log in with your favorite 2FA provider",
    twoFactorNudgeDescription:
      "Connect a YubiKey or Duo code to protect your vault. No one gets in without the key.",
  },
};

const emergencyContacts: ContentSet = {
  options: {
    titleKey: "emergencyAccessNudgeTitle",
    descriptionKey: "emergencyAccessNudgeDescription",
  },
  messages: {
    emergencyAccessNudgeTitle: "Add a trusted contact as a backup",
    emergencyAccessNudgeDescription:
      "Designate a trusted person to access your vault in an emergency where you are locked out.",
  },
};

const premiumReports: ContentSet = {
  options: {
    titleKey: "reportsNudgeTitle",
    descriptionKey: "reportsNudgeDescription",
    unlockedFeatureKeys: [
      "reportsNudgeWeakPasswords",
      "reportsNudgeUnsecureWebsites",
      "reportsNudgeInactiveTwoStep",
    ],
  },
  messages: {
    reportsNudgeTitle: "Find and fix security risks with reports",
    reportsNudgeDescription: "Health reports scan every item in your vault and flag what to fix.",
    reportsNudgeWeakPasswords: "Weak, reused, and exposed passwords",
    reportsNudgeUnsecureWebsites: "Unsecure websites",
    reportsNudgeInactiveTwoStep: "Inactive 2-step login",
  },
};

export default {
  title: "Billing/Premium Upgrade Nudge",
  component: PremiumUpgradeNudgeComponent,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/l0zlI2VvIU7gPe4MD0mMSH/?node-id=3230-52559",
    },
    docs: {
      description: {
        component:
          "Extension stories render the bottom-sheet layout, which the dialog only takes below the `md` breakpoint. Narrow the canvas below 768px to review them at popup width.",
      },
    },
  },
} as Meta<PremiumUpgradeNudgeComponent>;

export const TotpExtension = nudgeStory({ content: totp, client: ClientType.Browser });
export const TotpExtensionDark = dark(TotpExtension);
export const TotpExtensionSelfHosted = nudgeStory({
  content: totp,
  client: ClientType.Browser,
  selfHosted: true,
});

export const TotpDesktop = nudgeStory({ content: totp, client: ClientType.Desktop });
export const TotpDesktopDark = dark(TotpDesktop);
export const TotpDesktopSelfHosted = nudgeStory({
  content: totp,
  client: ClientType.Desktop,
  selfHosted: true,
});

export const TotpWeb = nudgeStory({ content: totp, client: ClientType.Web });
export const TotpWebDark = dark(TotpWeb);
export const TotpWebSelfHosted = nudgeStory({
  content: totp,
  client: ClientType.Web,
  selfHosted: true,
});

export const FileSendExtension = nudgeStory({
  content: fileSendExtension,
  client: ClientType.Browser,
});
export const FileSendExtensionSelfHosted = nudgeStory({
  content: fileSendExtension,
  client: ClientType.Browser,
  selfHosted: true,
});

export const FileSendWeb = nudgeStory({ content: fileSendWebDesktop, client: ClientType.Web });
export const FileSendWebSelfHosted = nudgeStory({
  content: fileSendWebDesktop,
  client: ClientType.Web,
  selfHosted: true,
});

export const FileSendDesktop = nudgeStory({
  content: fileSendWebDesktop,
  client: ClientType.Desktop,
});
export const FileSendDesktopSelfHosted = nudgeStory({
  content: fileSendWebDesktop,
  client: ClientType.Desktop,
  selfHosted: true,
});

export const AttachmentsExtension = nudgeStory({
  content: attachmentsExtension,
  client: ClientType.Browser,
});
export const AttachmentsExtensionSelfHosted = nudgeStory({
  content: attachmentsExtension,
  client: ClientType.Browser,
  selfHosted: true,
});

export const AttachmentsWeb = nudgeStory({
  content: attachmentsWebDesktop,
  client: ClientType.Web,
});
export const AttachmentsWebSelfHosted = nudgeStory({
  content: attachmentsWebDesktop,
  client: ClientType.Web,
  selfHosted: true,
});

export const AttachmentsDesktop = nudgeStory({
  content: attachmentsWebDesktop,
  client: ClientType.Desktop,
});
export const AttachmentsDesktopSelfHosted = nudgeStory({
  content: attachmentsWebDesktop,
  client: ClientType.Desktop,
  selfHosted: true,
});

export const ArchiveExtension = nudgeStory({ content: archive, client: ClientType.Browser });
export const ArchiveExtensionSelfHosted = nudgeStory({
  content: archive,
  client: ClientType.Browser,
  selfHosted: true,
});

export const ArchiveWeb = nudgeStory({ content: archive, client: ClientType.Web });
export const ArchiveWebSelfHosted = nudgeStory({
  content: archive,
  client: ClientType.Web,
  selfHosted: true,
});

export const ArchiveDesktop = nudgeStory({ content: archive, client: ClientType.Desktop });
export const ArchiveDesktopSelfHosted = nudgeStory({
  content: archive,
  client: ClientType.Desktop,
  selfHosted: true,
});

export const TwoFactorSetup = nudgeStory({ content: twoFactorSetup, client: ClientType.Web });
export const TwoFactorSetupSelfHosted = nudgeStory({
  content: twoFactorSetup,
  client: ClientType.Web,
  selfHosted: true,
});

export const EmergencyContacts = nudgeStory({
  content: emergencyContacts,
  client: ClientType.Web,
});
export const EmergencyContactsSelfHosted = nudgeStory({
  content: emergencyContacts,
  client: ClientType.Web,
  selfHosted: true,
});

export const PremiumReports = nudgeStory({ content: premiumReports, client: ClientType.Web });
export const PremiumReportsSelfHosted = nudgeStory({
  content: premiumReports,
  client: ClientType.Web,
  selfHosted: true,
});
