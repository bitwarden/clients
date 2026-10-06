import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { of } from "rxjs";
import { action } from "storybook/actions";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { OrganizationAuthRequestApiService } from "@bitwarden/bit-common/admin-console/auth-requests/organization-auth-request-api.service";
import { PendingAuthRequestView } from "@bitwarden/bit-common/admin-console/auth-requests/pending-auth-request.view";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { LayoutComponent, StorybookGlobalStateProvider, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { GlobalStateProvider } from "@bitwarden/state";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { DeviceApprovalsComponent } from "./device-approvals.component";

const ORG_ID = "org-story-1";

function pendingRequest(overrides: Partial<PendingAuthRequestView> = {}): PendingAuthRequestView {
  return Object.assign(new PendingAuthRequestView(), {
    id: "request-1",
    userId: "user-1",
    organizationUserId: "org-user-1",
    email: "jane.doe@example.com",
    publicKey: "cGVuZGluZy1wdWJsaWMta2V5",
    requestDeviceIdentifier: "device-1",
    requestDeviceType: "Chrome on Mac OS X",
    requestIpAddress: "1.2.3.4",
    requestCountryName: "United States",
    creationDate: new Date("2026-01-01T12:00:00.000Z"),
    ...overrides,
  });
}

function storyProviders(pendingRequests: PendingAuthRequestView[]) {
  return moduleMetadata({
    providers: [
      {
        provide: OrganizationAuthRequestApiService,
        useValue: {
          listPendingRequests: async () => pendingRequests,
          denyPendingRequests: action("OrganizationAuthRequestApiService.denyPendingRequests"),
          bulkUpdatePendingRequests: action(
            "OrganizationAuthRequestApiService.bulkUpdatePendingRequests",
          ),
          approvePendingRequest: action("OrganizationAuthRequestApiService.approvePendingRequest"),
          denyPendingRequest: action("OrganizationAuthRequestApiService.denyPendingRequest"),
        },
      },
      {
        provide: LegacyCompatKeyService,
        useValue: { getFingerprint: async () => ["fingerprint", "phrase", "words"] },
      },
      {
        provide: KeyService,
        useValue: { orgKeys$: () => of({}) },
      },
      {
        provide: EncryptService,
        useValue: {},
      },
      {
        provide: OrganizationUserApiService,
        useValue: {},
      },
      {
        provide: ToastService,
        useValue: { showToast: action("ToastService.showToast") },
      },
      {
        provide: ApiService,
        useValue: {
          send: async (): Promise<{ Data: unknown[]; ContinuationToken: null }> => ({
            Data: pendingRequests.map((r) => ({
              Id: r.id,
              UserId: r.userId,
              OrganizationUserId: r.organizationUserId,
              Email: r.email,
              PublicKey: r.publicKey,
              RequestDeviceIdentifier: r.requestDeviceIdentifier,
              RequestDeviceType: r.requestDeviceType,
              RequestIpAddress: r.requestIpAddress,
              RequestCountryName: r.requestCountryName,
              CreationDate: r.creationDate.toISOString(),
            })),
            ContinuationToken: null,
          }),
        },
      },
      {
        provide: LogService,
        useValue: { error: action("LogService.error") },
      },
      {
        provide: ValidationService,
        useValue: { showError: action("ValidationService.showError") },
      },
    ],
  });
}

const rootProviders = applicationConfig({
  providers: [
    importProvidersFrom(PreloadedEnglishI18nModule),
    {
      provide: ActivatedRoute,
      useValue: {
        params: of({ organizationId: ORG_ID }),
        data: of({ titleId: "" }),
        paramMap: of(convertToParamMap({ organizationId: ORG_ID })),
      },
    },
    {
      provide: AccountService,
      useValue: {
        activeAccount$: of({ id: "user-1", email: "user@example.com", emailVerified: true }),
      },
    },
    {
      provide: PlatformUtilsService,
      useValue: { isSelfHost: () => false, copyToClipboard: () => {} },
    },
    {
      provide: ConfigService,
      useValue: {
        getFeatureFlag$: () => of(true),
      },
    },
    { provide: GlobalStateProvider, useClass: StorybookGlobalStateProvider },
  ],
});

export default {
  title: "Admin Console/Organizations/Manage/Device Approvals",
  component: DeviceApprovalsComponent,
  decorators: [
    componentWrapperDecorator(
      (story) => `<bit-layout style="height: 800px" class="tw-p-6">${story}</bit-layout>`,
    ),
    moduleMetadata({ imports: [LayoutComponent] }),
    rootProviders,
  ],
} satisfies Meta<DeviceApprovalsComponent>;

type Story = StoryObj<DeviceApprovalsComponent>;

export const Default: Story = {
  decorators: [
    storyProviders([
      pendingRequest({
        id: "request-1",
        email: "jane.doe@example.com",
        requestDeviceType: "Chrome on Mac OS X",
        requestIpAddress: "1.2.3.4",
      }),
      pendingRequest({
        id: "request-2",
        email: "john.smith@example.com",
        requestDeviceType: "Firefox on Windows",
        requestIpAddress: "5.6.7.8",
        creationDate: new Date("2026-01-02T09:30:00.000Z"),
      }),
    ]),
  ],
};

export const Empty: Story = {
  decorators: [storyProviders([])],
};
