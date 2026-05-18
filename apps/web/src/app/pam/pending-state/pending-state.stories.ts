import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { Observable, Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { I18nMockService, ToastService } from "@bitwarden/components";
import {
  LeaseEvent,
  LeaseEventKind,
  LeaseEventService,
  LeaseRequestResponse,
  PamApiService,
} from "@bitwarden/pam";

import { PendingStateComponent } from "./pending-state.component";

const now = Date.now();
const oneMinute = 60_000;
const oneHour = 60 * oneMinute;

function makeRequest(overrides: Partial<Record<string, unknown>> = {}): LeaseRequestResponse {
  return new LeaseRequestResponse({
    Id: "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterUserId: "me",
    Status: "pending",
    RequestedNotBefore: null,
    RequestedNotAfter: new Date(now + oneHour).toISOString(),
    RequestedTtlSeconds: 3600,
    Reason: "Incident triage",
    SubmittedAt: new Date(now - 5 * oneMinute).toISOString(),
    ResolvedAt: null,
    ResolverUserId: null,
    ResolverComment: null,
    LeaseId: null,
    ...overrides,
  });
}

const i18nMock = () =>
  new I18nMockService({
    pendingStateTitle: "Pending approval — submitted $1 ago",
    pendingStateNotified: "Notified",
    pendingStateApproversTbd: "Awaiting approval",
    pendingStateCancelRequest: "Cancel request",
    pendingStateCancelSuccess: "Request cancelled.",
    pendingStateCancelError: "Couldn't cancel the request.",
    denialStateTitle: "Access denied",
    denialStateNoReason: "Access to this item was denied.",
  });

const eventSubject = new Subject<LeaseEvent>();

class StubLeaseEventService extends LeaseEventService {
  events$(_requestId: string): Observable<LeaseEvent> {
    return eventSubject.asObservable();
  }
}

const baseDecorators = [
  applicationConfig({ providers: [provideNoopAnimations()] }),
  moduleMetadata({
    providers: [
      { provide: I18nService, useFactory: i18nMock },
      {
        provide: PamApiService,
        useValue: {
          cancelLeaseRequest: () => Promise.resolve(),
        },
      },
      { provide: ToastService, useValue: { showToast: () => undefined } },
      { provide: LogService, useValue: { error: () => undefined } },
      { provide: LeaseEventService, useClass: StubLeaseEventService },
    ],
  }),
];

export default {
  title: "Web/PAM/Pending State",
  component: PendingStateComponent,
} as Meta<PendingStateComponent>;

type Story = StoryObj<PendingStateComponent>;

export const Pending: Story = {
  decorators: baseDecorators,
  args: {
    request: makeRequest(),
  },
};

export const PendingOlderRequest: Story = {
  decorators: baseDecorators,
  args: {
    request: makeRequest({ SubmittedAt: new Date(now - 2 * oneHour - 15 * oneMinute).toISOString() }),
  },
};

export const DeniedWithNoReason: Story = {
  decorators: [
    ...baseDecorators,
    moduleMetadata({
      providers: [
        {
          provide: LeaseEventService,
          useValue: {
            events$: (_id: string): Observable<LeaseEvent> => {
              const s = new Subject<LeaseEvent>();
              setTimeout(
                () => s.next({ kind: LeaseEventKind.Denied, requestId: "req-1" }),
                0,
              );
              return s.asObservable();
            },
          },
        },
      ],
    }),
  ],
  args: {
    request: makeRequest(),
  },
};
