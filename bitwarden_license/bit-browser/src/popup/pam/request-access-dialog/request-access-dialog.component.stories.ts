import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { userEvent, waitFor } from "storybook/test";

import {
  AccessRefreshService,
  AccessRequestSdkService,
  LeasingErrorService,
} from "@bitwarden/bit-common/pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DIALOG_DATA, DialogRef, I18nMockService, ToastService } from "@bitwarden/components";

import {
  RequestAccessDialogComponent,
  RequestAccessDialogParams,
} from "./request-access-dialog.component";

const SUBMIT = "#pam-request-access-dialog_button_submit";
const HUMAN_REASON = "#pam-request-access-dialog_textarea_human-reason";

/** An instant relative to render time. */
function fromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

/** The dialog pre-checks on open; `submitError`, when set, is what the submit rejects with. */
function pam(
  options: {
    mode?: "automatic" | "human";
    maxDurationSeconds?: number;
    canStartLease?: boolean;
    slotFreesAt?: () => string;
    submitError?: string;
  } = {},
) {
  const {
    mode = "automatic",
    maxDurationSeconds = 4 * 60 * 60,
    canStartLease = true,
    slotFreesAt,
    submitError,
  } = options;
  return moduleMetadata({
    providers: [
      {
        provide: AccessRequestSdkService,
        useValue: {
          preCheck: () =>
            Promise.resolve({
              approvalMode: mode,
              hasActiveLease: false,
              maxDurationSeconds,
              defaultDurationSeconds: 60 * 60,
              canStartLease,
              slotFreesAt: slotFreesAt?.(),
            }),
          submitAccessRequest: () =>
            submitError == null
              ? Promise.resolve({ approvalMode: mode })
              : Promise.reject(new Error(submitError)),
        },
      },
    ],
  });
}

/** Resolves once the pre-check has landed and the submit button is on screen. */
async function submitButton(canvasElement: HTMLElement): Promise<HTMLButtonElement> {
  return waitFor(() => {
    const button = canvasElement.querySelector<HTMLButtonElement>(SUBMIT);
    if (button == null) {
      throw new Error("submit not rendered yet");
    }
    return button;
  });
}

export default {
  title: "Browser/PAM/Request Access Dialog",
  component: RequestAccessDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [RequestAccessDialogComponent],
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            cipherId: "cipher-1",
            itemName: "Prod database",
          } satisfies RequestAccessDialogParams,
        },
        { provide: DialogRef, useValue: { close: () => {} } },
        { provide: AccessRefreshService, useValue: { notifyAccessChanged: () => {} } },
        { provide: LeasingErrorService, useValue: { isLeasingError: () => false } },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: LogService, useValue: { error: () => {} } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              cancel: "Cancel",
              close: "Close",
              inputRequired: "Input is required.",
              loading: "Loading",
              pamRequestSlotTaken:
                "Someone else has access to this item right now. You can request access, but you won't be able to start it until they're done.",
              pamRequestSlotTakenUntil: (time) =>
                `Someone else has access to this item right now. You can request access, but you won't be able to start it until ${time}.`,
              requestAccessModalAutomaticDescription:
                "Pick a duration. You'll get immediate access for that long.",
              requestAccessModalAutomaticReasonHint:
                "This reason is saved with your access request.",
              requestAccessModalDate: "Date",
              requestAccessModalDuration: "Duration",
              requestAccessModalDuration15m: "15 minutes",
              requestAccessModalDuration1d: "1 day",
              requestAccessModalDuration1h: "1 hour",
              requestAccessModalDuration30m: "30 minutes",
              requestAccessModalDuration4h: "4 hours",
              requestAccessModalDuration8h: "8 hours",
              requestAccessModalEnd: "End time",
              requestAccessModalEndEqualsStart: "End time can't be the same as the start time.",
              requestAccessModalEndsNextDay: (date) => `Ends ${date}`,
              requestAccessModalGenericError: "Could not request access.",
              requestAccessModalHumanDescription:
                "Pick a window and tell the approver why you need access. They'll review and decide.",
              requestAccessModalHumanReasonHint:
                "Approvers will see this reason when reviewing your request.",
              requestAccessModalReasonOptional: "Reason (optional)",
              requestAccessModalReasonPlaceholder: "Why do you need this?",
              requestAccessModalReasonRequired: "Reason",
              requestAccessModalStart: "Start time",
              requestAccessModalSubmit: "Request access",
              requestAccessModalTitle: "Request access",
              requestAccessModalWindowExceedsMax: (duration) =>
                `The window can't exceed ${duration}.`,
              requestAccessModalWindowInPast:
                "The requested window has already ended. Pick a later date or time.",
            }),
        },
      ],
    }),
  ],
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
  /** Rendered at the popup's 380px width. */
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-w-[380px]">
        <app-pam-request-access-dialog />
      </div>
    `,
  }),
} as Meta<RequestAccessDialogComponent>;

type Story = StoryObj<RequestAccessDialogComponent>;

/** An auto-approving rule: a duration narrowed to the rule's cap, and an optional reason. */
export const AutomaticApproval: Story = {
  decorators: [pam()],
};

/**
 * A rule that requires human approval: a window pre-filled from the rule's default plus a required
 * justification. The two time fields are the one row kept side by side.
 */
export const HumanApproval: Story = {
  decorators: [pam({ mode: "human", maxDurationSeconds: 24 * 60 * 60 })],
};

/**
 * The automatic path with the single-active-lease slot already held. The warning replaces the
 * immediate-access copy, and the form stays submittable because the request is still worth making.
 * This is the longest string on the surface, so it sets the worst-case height.
 */
export const SlotTaken: Story = {
  decorators: [pam({ canStartLease: false, slotFreesAt: () => fromNow(20 * 60 * 1000) })],
};

/** Submitting the human path without a reason marks the field. */
export const ValidationError: Story = {
  decorators: [pam({ mode: "human" })],
  play: async ({ canvasElement }) => {
    await userEvent.click(await submitButton(canvasElement));
  },
};

/** An unrecognised refusal falls back to the generic copy under the form. */
export const SubmitError: Story = {
  decorators: [pam({ submitError: "the server exploded" })],
  play: async ({ canvasElement }) => {
    await userEvent.click(await submitButton(canvasElement));
  },
};

/** The server applied a narrower cap than the form knew of, re-rendered in the requester's words. */
export const ExceedsMax: Story = {
  decorators: [
    pam({
      mode: "human",
      submitError: "The requested window exceeds the maximum of 1800 seconds.",
    }),
  ],
  play: async ({ canvasElement }) => {
    const submit = await submitButton(canvasElement);
    const reason = canvasElement.querySelector<HTMLTextAreaElement>(HUMAN_REASON)!;
    await userEvent.type(reason, "Rotating the replica credentials.");
    await userEvent.click(submit);
  },
};
