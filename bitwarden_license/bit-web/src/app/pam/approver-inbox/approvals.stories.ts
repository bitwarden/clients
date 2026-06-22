import { importProvidersFrom } from "@angular/core";
import { provideRouter } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { AccessRequestDetailsResponse } from "@bitwarden/bit-pam";
import { DialogModule } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { ApprovalsComponent } from "./approvals.component";

const CURRENT_USER = "user-me";

function row(
  overrides: Partial<{
    id: string;
    requesterId: string;
    requesterName: string;
    cipherName: string;
    collectionName: string;
    reason: string | null;
    submittedAt: string;
    requestedNotBefore: string | null;
    requestedNotAfter: string | null;
    requestedTtlSeconds: number;
  }> = {},
): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: overrides.id ?? "req-1",
    CipherId: "cipher-" + (overrides.id ?? "req-1"),
    CollectionId: "col-1",
    RequesterUserId: overrides.requesterId ?? "user-other",
    Status: "pending",
    RequestedNotBefore: overrides.requestedNotBefore ?? null,
    RequestedNotAfter: overrides.requestedNotAfter ?? null,
    RequestedTtlSeconds: overrides.requestedTtlSeconds ?? 3600,
    Reason: overrides.reason ?? "Investigating a production incident",
    SubmittedAt: overrides.submittedAt ?? new Date(Date.now() - 7 * 60_000).toISOString(),
    CipherName: overrides.cipherName ?? "Prod DB admin",
    CollectionName: overrides.collectionName ?? "Production",
    RequesterName: overrides.requesterName ?? "Bob Engineer",
    RequesterEmail: "bob@example.com",
  });
}

export default {
  title: "Web/PAM/Approvals",
  component: ApprovalsComponent,
  decorators: [
    moduleMetadata({ imports: [DialogModule] }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule), provideRouter([])],
    }),
  ],
  args: {
    currentUserId: CURRENT_USER,
    now: new Date(),
    loading: false,
    hasManagerCollections: true,
  },
} as Meta<ApprovalsComponent>;

type Story = StoryObj<ApprovalsComponent>;

export const Empty: Story = {
  args: { requests: [] },
};

// The empty state shown to a viewer who manages no leasing collections, so can never approve.
export const EmptyNoApprover: Story = {
  args: { requests: [], hasManagerCollections: false },
};

export const Populated: Story = {
  args: {
    requests: [
      row({
        id: "a",
        cipherName: "Prod DB admin",
        collectionName: "Production",
        submittedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      }),
      row({
        id: "b",
        cipherName: "Staging API key",
        collectionName: "Staging",
        reason: null,
        requestedTtlSeconds: 7200,
        requestedNotBefore: new Date(Date.now() + 60 * 60_000).toISOString(),
        requestedNotAfter: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
      }),
      // The viewer's own request — actions render disabled (self-approval guard).
      row({
        id: "self",
        requesterId: CURRENT_USER,
        requesterName: "Me",
        cipherName: "My own request",
        collectionName: "Production",
      }),
    ],
  },
};
