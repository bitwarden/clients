import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { AccessRequestSdkService, LeasingErrorService } from "@bitwarden/bit-pam";
import {
  RequestAccessSheetComponent,
  RequestAccessSheetParams,
} from "@bitwarden/bit-pam-components";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { HOUR, fromNow, startClockAtStoryNow } from "@bitwarden/storybook";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { provideStoryChangeDetection, provideStoryLogService } from "../testing/story-fixtures";

const params: RequestAccessSheetParams = { cipherId: "cipher-1", itemName: "Prod database" };

/** Provided per story, since the sheet pre-checks once when it opens. */
function preCheck(options: {
  mode: "automatic" | "human";
  canStartLease?: boolean;
  slotFreesAt?: string;
}) {
  const { mode, canStartLease = true, slotFreesAt } = options;
  return moduleMetadata({
    providers: [
      {
        provide: AccessRequestSdkService,
        useValue: {
          preCheck: () =>
            Promise.resolve({
              approvalMode: mode,
              hasActiveLease: false,
              defaultDurationSeconds: HOUR / 1000,
              maxDurationSeconds: (4 * HOUR) / 1000,
              canStartLease,
              slotFreesAt,
            }),
        },
      },
    ],
  });
}

export default {
  title: "Web/PAM/Request Access Sheet",
  component: RequestAccessSheetComponent,
  beforeEach: startClockAtStoryNow,
  decorators: [
    moduleMetadata({
      imports: [RequestAccessSheetComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: { close: () => {} } },
        { provide: LeasingErrorService, useValue: { isLeasingError: () => false } },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: PlatformUtilsService, useValue: { copyToClipboard: () => {} } },
      ],
    }),
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideStoryLogService(),
      ],
    }),
  ],
  render: () => ({ template: `<app-pam-request-access-sheet />` }),
} as Meta<RequestAccessSheetComponent>;

type Story = StoryObj<RequestAccessSheetComponent>;

/** An auto-approving rule asks for a duration and an optional reason. */
export const Automatic: Story = {
  decorators: [preCheck({ mode: "automatic" })],
};

/**
 * A human-approval rule asks for a window and a required reason. The window seeds from
 * `new Date()`, which the story clock does not move, so Chromatic skips it.
 */
export const HumanApproval: Story = {
  decorators: [preCheck({ mode: "human" })],
  parameters: { chromatic: { disableSnapshot: true } },
};

/** Another member holds the single active lease, so the sheet says when it frees. */
export const SlotTaken: Story = {
  decorators: [preCheck({ mode: "automatic", canStartLease: false, slotFreesAt: fromNow(HOUR) })],
};
