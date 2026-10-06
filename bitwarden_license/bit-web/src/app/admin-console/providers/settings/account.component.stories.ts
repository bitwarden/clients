import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { action } from "storybook/actions";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderResponse } from "@bitwarden/common/admin-console/models/response/provider/provider.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import {
  AvatarComponent,
  ContainerComponent,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { DangerZoneComponent } from "@bitwarden/web-vault/app/auth/settings/account/danger-zone.component";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { AccountComponent } from "./account.component";

const PROVIDER_ID = "provider-story-1";

const mockProvider = new ProviderResponse({
  Id: PROVIDER_ID,
  Name: "Acme MSP",
  BusinessName: "Acme MSP",
  BillingEmail: "billing@acme-msp.example",
  CreationDate: "2024-01-01T00:00:00.000Z",
});

@Component({
  selector: "app-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubHeaderComponent {}

export default {
  title: "Admin Console/Providers/Settings/Account",
  component: AccountComponent,
  decorators: [
    moduleMetadata({
      declarations: [AccountComponent],
      imports: [
        SharedModule,
        ContainerComponent,
        AvatarComponent,
        DangerZoneComponent,
        StubHeaderComponent,
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            parent: { parent: { params: of({ providerId: PROVIDER_ID }) } },
          },
        },
        {
          provide: ProviderApiServiceAbstraction,
          useValue: {
            getProvider: async () => mockProvider,
            putProvider: async () => mockProvider,
            deleteProvider: action("ProviderApiService.deleteProvider"),
          },
        },
        {
          provide: ApiService,
          useValue: { getProviderClients: async () => ({ data: [] as unknown[] }) },
        },
        { provide: PlatformUtilsService, useValue: { isSelfHost: () => false } },
        { provide: SyncService, useValue: { fullSync: async () => true } },
        { provide: LogService, useValue: { error: action("LogService.error") } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
        { provide: DialogService, useValue: { openSimpleDialog: async () => true } },
        { provide: ToastService, useValue: { showToast: action("ToastService.showToast") } },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} satisfies Meta<AccountComponent>;

type Story = StoryObj<AccountComponent>;

export const Default: Story = {};
