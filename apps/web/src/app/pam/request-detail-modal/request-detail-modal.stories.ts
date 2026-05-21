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
import { LeaseRequestResponse, PamApiService } from "@bitwarden/pam";

import {
  RequestDetailModalComponent,
  RequestDetailModalData,
  RequestDetailModalResult,
} from "./request-detail-modal.component";

const oneHour = 60 * 60 * 1000;
const now = Date.now();

function makeRequest(overrides: Partial<Record<string, unknown>> = {}): LeaseRequestResponse {
  return new LeaseRequestResponse({
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
    requestDetailModalTitle: "Request access",
    requestDetailModalDescription:
      "Amend the access window and optional reason before your approver reviews the request.",
    requestDetailModalNotBefore: "Access from",
    requestDetailModalNotAfter: "Access until",
    requestDetailModalNotAfterHint: "When you need access to end.",
    requestDetailModalReason: "Reason (optional)",
    requestDetailModalReasonPlaceholder: "e.g. Incident response",
    requestDetailModalReasonHint: "Visible to approvers.",
    requestDetailModalSubmit: "Submit",
    requestDetailModalCancelRequest: "Cancel request",
    requestDetailModalDismiss: "Dismiss",
    requestDetailModalSubmitSuccess: "Request submitted.",
    requestDetailModalSubmitError: "Couldn't submit the request.",
    requestDetailModalCancelSuccess: "Request cancelled.",
    requestDetailModalCancelError: "Couldn't cancel the request.",
  });

function pamApiStub(): PamApiService {
  return {
    fetchGatedCipher: () => Promise.reject(new Error("not implemented")),
    patchLeaseRequest: (_id: string) => Promise.resolve(makeRequest()),
    cancelLeaseRequest: () => Promise.resolve(),
    requestLeaseExtension: () => Promise.reject(new Error("not implemented")),
    decideLeaseRequest: () => Promise.reject(new Error("not implemented")),
    revokeLease: () => Promise.resolve(),
    setCollectionLeasingConfig: () => Promise.reject(new Error("not implemented")),
    listMyRequests: () => Promise.resolve([]),
  } as unknown as PamApiService;
}

const withData = (data: RequestDetailModalData) => ({
  decorators: [
    applicationConfig({ providers: [provideNoopAnimations()] }),
    moduleMetadata({
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close: (_r: RequestDetailModalResult) => undefined } },
        { provide: I18nService, useFactory: i18nMock },
        { provide: PamApiService, useValue: pamApiStub() },
        { provide: ToastService, useValue: { showToast: () => undefined } },
        { provide: LogService, useValue: { error: () => undefined } },
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
  component: RequestDetailModalComponent,
} as Meta<RequestDetailModalComponent>;

type Story = StoryObj<RequestDetailModalComponent>;

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
