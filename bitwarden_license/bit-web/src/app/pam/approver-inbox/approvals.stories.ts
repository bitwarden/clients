import { importProvidersFrom } from "@angular/core";
import { provideRouter } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { AccessRequestDetailsResponse } from "@bitwarden/bit-pam";
import { DialogModule } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { ResolvedNames, emptyResolvedNames } from "../access-request-name-resolver.service";

import { ApprovalsComponent } from "./approvals.component";

const CURRENT_USER = "user-me";

function row(
  overrides: Partial<{
    id: string;
    requesterId: string;
    requesterName: string;
    collectionId: string;
    reason: string | null;
    submittedAt: string;
    requestedNotBefore: string | null;
    requestedNotAfter: string | null;
  }> = {},
): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: overrides.id ?? "req-1",
    CipherId: "cipher-" + (overrides.id ?? "req-1"),
    CollectionId: overrides.collectionId ?? "col-1",
    RequesterUserId: overrides.requesterId ?? "user-other",
    Status: "pending",
    RequestedNotBefore: overrides.requestedNotBefore ?? null,
    RequestedNotAfter: overrides.requestedNotAfter ?? null,
    Reason: overrides.reason ?? "Investigating a production incident",
    SubmittedAt: overrides.submittedAt ?? new Date(Date.now() - 7 * 60_000).toISOString(),
    RequesterName: overrides.requesterName ?? "Bob Engineer",
    RequesterEmail: "bob@example.com",
  });
}

/** Display names the resolver would supply from local vault state, keyed by cipher/collection id. */
function names(
  entries: { cipherId: string; cipherName: string; collectionId: string; collectionName: string }[],
): ResolvedNames {
  return {
    cipherNameById: new Map(entries.map((e) => [e.cipherId, e.cipherName])),
    collectionNameById: new Map(entries.map((e) => [e.collectionId, e.collectionName])),
    cipherById: new Map(),
  };
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
    names: emptyResolvedNames(),
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
        collectionId: "col-prod",
        submittedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      }),
      row({
        id: "b",
        collectionId: "col-staging",
        reason: null,
        requestedNotBefore: new Date(Date.now() + 60 * 60_000).toISOString(),
        requestedNotAfter: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
      }),
      // The viewer's own request — actions render disabled (self-approval guard).
      row({
        id: "self",
        requesterId: CURRENT_USER,
        requesterName: "Me",
        collectionId: "col-prod",
      }),
    ],
    names: names([
      {
        cipherId: "cipher-a",
        cipherName: "Prod DB admin",
        collectionId: "col-prod",
        collectionName: "Production",
      },
      {
        cipherId: "cipher-b",
        cipherName: "Staging API key",
        collectionId: "col-staging",
        collectionName: "Staging",
      },
      {
        cipherId: "cipher-self",
        cipherName: "My own request",
        collectionId: "col-prod",
        collectionName: "Production",
      },
    ]),
  },
};
