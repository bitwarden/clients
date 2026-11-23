import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { action } from "storybook/actions";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, I18nMockService } from "@bitwarden/components";

import {
  PremiumCheckoutProcessingComponent,
  PremiumCheckoutProcessingDialogData,
} from "./premium-checkout-processing.component";

type Story = StoryObj<PremiumCheckoutProcessingComponent>;

const messages: Record<string, string> = {
  confirmingYourUpgrade: "Confirming your upgrade",
  confirmingYourUpgradeDesc:
    "We're confirming your payment. If it went through, Premium features like __$1__ will be available soon.",
  close: "Close",
  totpFeatureName: "TOTP verification codes",
  fileSendFeatureName: "file Sends",
  attachmentsFeatureName: "attachments",
  archiveFeatureName: "archive",
  longFeatureName: "emergency access for trusted contacts and organization members",
};

const processingStory = ({
  featureNameKey,
  popup = false,
  overrides = {},
}: {
  featureNameKey: string;
  popup?: boolean;
  overrides?: Record<string, string>;
}): Story => {
  const data: PremiumCheckoutProcessingDialogData = { featureNameKey };

  return {
    parameters: popup ? { chromatic: { viewports: [380] } } : undefined,
    decorators: [
      moduleMetadata({
        imports: [NoopAnimationsModule],
        providers: [
          { provide: DIALOG_DATA, useValue: data },
          {
            provide: DialogRef,
            useValue: { close: action("DialogRef.close"), disableClose: false },
          },
          {
            provide: I18nService,
            useFactory: () => new I18nMockService({ ...messages, ...overrides }),
          },
        ],
      }),
    ],
  };
};

const dark = (story: Story): Story => ({ ...story, globals: { theme: "dark" } });

export default {
  title: "Billing/Premium Checkout Processing",
  component: PremiumCheckoutProcessingComponent,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/l0zlI2VvIU7gPe4MD0mMSH/?node-id=3230-52558",
    },
  },
} as Meta<PremiumCheckoutProcessingComponent>;

export const Totp = processingStory({ featureNameKey: "totpFeatureName" });
export const FileSend = processingStory({ featureNameKey: "fileSendFeatureName" });
export const Attachments = processingStory({ featureNameKey: "attachmentsFeatureName" });
export const Archive = processingStory({ featureNameKey: "archiveFeatureName" });
export const Dark = dark(Totp);
export const NarrowPopup = processingStory({ featureNameKey: "totpFeatureName", popup: true });
export const LongFeatureName = processingStory({ featureNameKey: "longFeatureName", popup: true });
export const LongTranslation = processingStory({
  featureNameKey: "attachmentsFeatureName",
  popup: true,
  overrides: {
    confirmingYourUpgrade: "Ihr Upgrade wird bestätigt",
    confirmingYourUpgradeDesc:
      "Wir bestätigen Ihre Zahlung. Wenn sie erfolgreich war, sind Premium-Funktionen wie __$1__ in Kürze verfügbar.",
    attachmentsFeatureName: "Dateianhänge",
    close: "Schließen",
  },
});
