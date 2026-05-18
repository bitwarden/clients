import { importProvidersFrom } from "@angular/core";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  I18nMockService,
  ToastService,
} from "@bitwarden/components";
import { LeaseRequestResponse, PamApiService } from "@bitwarden/pam";

import { LeaseExtensionModalComponent, LeaseExtensionModalData } from "./lease-extension-modal.component";

const now = Date.now();

const LEASE_ID = "lease-story-1";
const CURRENT_NOT_AFTER = new Date(now + 30 * 60 * 1000).toISOString();

const data: LeaseExtensionModalData = {
  leaseId: LEASE_ID,
  currentNotAfter: CURRENT_NOT_AFTER,
};

function i18nMock() {
  return new I18nMockService({
    cancel: "Cancel",
    leaseExtensionModalTitle: "Request extension",
    leaseExtensionModalDescription:
      "Request an extension to your active lease. Enter the new window and an optional reason.",
    leaseExtensionModalWindowStart: "New window start",
    leaseExtensionModalWindowEnd: "New window end",
    leaseExtensionModalReasonLabel: "Reason (optional)",
    leaseExtensionModalReasonPlaceholder: "Why do you need more time?",
    leaseExtensionModalSubmit: "Request extension",
    leaseExtensionModalAutoApprovedToast: "Lease extended.",
    leaseExtensionModalPendingToast: "Extension request submitted. Awaiting approval.",
    leaseExtensionModalErrorToast: "Could not submit the extension request. Try again.",
  });
}

function fakeApprovedApi(): PamApiService {
  return {
    requestLeaseExtension: () =>
      Promise.resolve(
        new LeaseRequestResponse({
          Id: "req-approved",
          Status: "approved",
          CipherId: "cipher-1",
          CollectionId: "col-1",
          RequesterUserId: "user-1",
          RequestedNotBefore: null,
          RequestedNotAfter: null,
          RequestedTtlSeconds: 3600,
          Reason: null,
          SubmittedAt: new Date().toISOString(),
          LeaseId: LEASE_ID,
        }),
      ),
  } as unknown as PamApiService;
}

function fakePendingApi(): PamApiService {
  return {
    requestLeaseExtension: () =>
      Promise.resolve(
        new LeaseRequestResponse({
          Id: "req-pending",
          Status: "pending",
          CipherId: "cipher-1",
          CollectionId: "col-1",
          RequesterUserId: "user-1",
          RequestedNotBefore: null,
          RequestedNotAfter: null,
          RequestedTtlSeconds: 3600,
          Reason: null,
          SubmittedAt: new Date().toISOString(),
          LeaseId: null,
        }),
      ),
  } as unknown as PamApiService;
}

function fakeErrorApi(): PamApiService {
  return {
    requestLeaseExtension: () => Promise.reject(new Error("Server error")),
  } as unknown as PamApiService;
}

function storyProviders(api: PamApiService) {
  return [
    applicationConfig({
      providers: [importProvidersFrom(NoopAnimationsModule)],
    }),
    moduleMetadata({
      providers: [
        { provide: I18nService, useFactory: i18nMock },
        { provide: DIALOG_DATA, useValue: data },
        {
          provide: DialogRef,
          useValue: { close: (result: unknown) => console.log("Dialog closed with:", result) },
        },
        { provide: PamApiService, useValue: api },
        { provide: ToastService, useValue: { showToast: (t: unknown) => console.log("Toast:", t) } },
        { provide: LogService, useValue: { error: console.error } },
      ],
    }),
  ];
}

export default {
  title: "Web/PAM/Lease Extension Modal",
  component: LeaseExtensionModalComponent,
} as Meta<LeaseExtensionModalComponent>;

type Story = StoryObj<LeaseExtensionModalComponent>;

export const AutoApproved: Story = {
  decorators: storyProviders(fakeApprovedApi()),
};

export const PendingApproval: Story = {
  decorators: storyProviders(fakePendingApi()),
};

export const SubmitError: Story = {
  decorators: storyProviders(fakeErrorApi()),
};
