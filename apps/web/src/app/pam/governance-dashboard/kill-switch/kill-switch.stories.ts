import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { BulkRevokeResult, PamApiService } from "@bitwarden/pam";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { KillSwitchDialogResult } from "./kill-switch-dialog.component";
import { KillSwitchComponent } from "./kill-switch.component";

class StubPamApiService {
  bulkRevokeLeases(_orgId: string): Promise<BulkRevokeResult> {
    return new Promise(() => undefined);
  }
}

class StubConfigService {
  getFeatureFlag$(_flag: unknown) {
    return of(true);
  }
}

class StubI18nService {
  t(key: string, ...args: string[]): string {
    return args.length > 0 ? `${key}:${args.join(",")}` : key;
  }
}

class StubLogService {
  error(_e: unknown): void {}
}

class StubToastService {
  showToast(_opts: unknown): void {}
}

export default {
  title: "Web/Admin Console/PAM/Kill Switch",
  component: KillSwitchComponent,
  decorators: [
    moduleMetadata({
      imports: [KillSwitchComponent],
      providers: [
        { provide: PamApiService, useClass: StubPamApiService },
        { provide: ConfigService, useClass: StubConfigService },
        { provide: I18nService, useClass: StubI18nService },
        { provide: LogService, useClass: StubLogService },
        { provide: ToastService, useClass: StubToastService },
        { provide: DialogService, useValue: { open: () => ({ closed: of(undefined) }) } },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  args: {
    organizationId: "org-1",
    organizationName: "Acme Corp",
  },
} as Meta<KillSwitchComponent>;

type Story = StoryObj<KillSwitchComponent>;

/** Kill switch button visible, no action taken yet. */
export const Idle: Story = {};

/** Success callout shown after all leases were revoked. */
export const Success: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: PamApiService,
          useValue: {
            bulkRevokeLeases: async (): Promise<BulkRevokeResult> => ({
              kind: "ok",
              revokedCount: 12,
            }),
          },
        },
        {
          provide: DialogService,
          useValue: {
            open: () => ({ closed: of(KillSwitchDialogResult.Confirmed) }),
          },
        },
      ],
    }),
  ],
};

/** Partial-failure callout shown when some leases could not be revoked. */
export const PartialFailure: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: PamApiService,
          useValue: {
            bulkRevokeLeases: async (): Promise<BulkRevokeResult> => ({
              kind: "partial",
              revokedCount: 8,
              failedCount: 3,
            }),
          },
        },
        {
          provide: DialogService,
          useValue: {
            open: () => ({ closed: of(KillSwitchDialogResult.Confirmed) }),
          },
        },
      ],
    }),
  ],
};
