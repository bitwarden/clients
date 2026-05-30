import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  DIALOG_DATA,
  DialogRef,
  I18nMockService,
  ToastService,
} from "@bitwarden/components";
import { AccessRequestResponse, PamApiService } from "@bitwarden/pam";

import {
  AccessRequestDetailModalComponent,
  AccessRequestDetailModalData,
  AccessRequestDetailModalResult,
} from "./access-request-detail-modal.component";

const oneHour = 60 * 60 * 1000;
const now = Date.now();

function makeRequest(overrides: Partial<Record<string, unknown>> = {}): AccessRequestResponse {
  return new AccessRequestResponse({
    Id: "req-storybook",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterUserId: "me",
    Status: "pending",
    RequestedNotBefore: null,
    RequestedNotAfter: new Date(now + oneHour).toISOString(),
    RequestedTtlSeconds: 3600,
    Reason: null,
    SubmittedAt: new Date(now - 5 * 60 * 1000).toISOString(),
    ResolvedAt: null,
    ResolverUserId: null,
    ResolverComment: null,
    LeaseId: null,
    ...overrides,
  });
}

const i18nMock = () =>
  new I18nMockService({
    accessRequestDetailModalTitle: "Request access",
    accessRequestDetailModalDescription:
      "Submit a request for temporary access to this item. You'll be notified as soon as it's reviewed.",
    accessRequestDetailModalNotBefore: "Access from",
    accessRequestDetailModalNotAfter: "Access until",
    accessRequestDetailModalNotAfterHint: "When you need access to end.",
    accessRequestDetailModalReason: "Reason (optional)",
    accessRequestDetailModalReasonPlaceholder: "e.g. Incident response",
    accessRequestDetailModalReasonHint: "Visible to approvers.",
    accessRequestDetailModalSubmit: "Submit",
    accessRequestDetailModalCancelRequest: "Cancel request",
    accessRequestDetailModalDismiss: "Dismiss",
    accessRequestDetailModalSubmitSuccess: "Request submitted.",
    accessRequestDetailModalSubmitError: "Couldn't submit the request.",
    accessRequestDetailModalCancelSuccess: "Request cancelled.",
    accessRequestDetailModalCancelError: "Couldn't cancel the request.",
  });

function pamApiStub(): PamApiService {
  return {
    fetchGatedCipher: () => Promise.reject(new Error("not implemented")),
    patchAccessRequest: (_id: string) => Promise.resolve(makeRequest()),
    cancelAccessRequest: () => Promise.resolve(),
    requestLeaseExtension: () => Promise.reject(new Error("not implemented")),
    decideAccessRequest: () => Promise.reject(new Error("not implemented")),
    revokeLease: () => Promise.resolve(),
    listMyRequests: () => Promise.resolve([]),
  } as unknown as PamApiService;
}

const withData = (data: AccessRequestDetailModalData) => ({
  decorators: [
    applicationConfig({ providers: [provideNoopAnimations()] }),
    moduleMetadata({
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close: (_r: AccessRequestDetailModalResult): void => undefined } },
        { provide: I18nService, useFactory: i18nMock },
        { provide: PamApiService, useValue: pamApiStub() },
        { provide: ToastService, useValue: { showToast: (): void => undefined } },
        { provide: LogService, useValue: { error: (): void => undefined } },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: (flag: FeatureFlag) =>
              flag === FeatureFlag.Pam
                ? new BehaviorSubject(true).asObservable()
                : new BehaviorSubject(false).asObservable(),
          },
        },
      ],
    }),
  ],
});

export default {
  title: "Web/PAM/Request Detail Modal",
  component: AccessRequestDetailModalComponent,
} as Meta<AccessRequestDetailModalComponent>;

type Story = StoryObj<AccessRequestDetailModalComponent>;

export const DefaultWindow: Story = {
  ...withData({ request: makeRequest() }),
};

export const WithExistingWindow: Story = {
  ...withData({
    request: makeRequest({
      RequestedNotBefore: new Date(now).toISOString(),
      RequestedNotAfter: new Date(now + 2 * oneHour).toISOString(),
      Reason: "Routine incident triage",
    }),
  }),
};

export const NoWindow: Story = {
  ...withData({
    request: makeRequest({
      RequestedNotBefore: null,
      RequestedNotAfter: null,
    }),
  }),
};
