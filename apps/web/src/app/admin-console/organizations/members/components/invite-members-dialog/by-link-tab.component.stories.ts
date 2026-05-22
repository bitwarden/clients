import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import {
  OrganizationInviteLink,
  OrganizationInviteLinkService,
} from "@bitwarden/organization-invite-link";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";

import { ByLinkTabComponent } from "./by-link-tab.component";

const mockInviteLink: OrganizationInviteLink = Object.assign(
  new OrganizationInviteLink({} as any),
  {
    id: "link-1",
    code: "abc123",
    organizationId: "org-1",
    allowedDomains: ["example.com", "acme.org"],
    encryptedInviteKey: "enc-key",
    encryptedOrgKey: undefined,
    creationDate: "2025-01-15T10:30:00Z",
  },
);

const mockAccountService = {
  activeAccount$: of({ id: "user-1" as UserId, email: "test@example.com" }),
};

const mockPlatformUtilsService = {
  copyToClipboard: () => {},
};

const mockToastService = {
  showToast: () => {},
};

type StoryArgs = {
  /** Whether an existing invite link has been generated for this organization. */
  hasExistingLink: boolean;
  /** Comma-separated allowed domains pre-filled in the input (only used when hasExistingLink is true). */
  allowedDomains: string;
  /** The invite link URL shown in the read-only input (only used when hasExistingLink is true). */
  inviteLinkUrl: string;
  /** ISO 8601 date string for when the link was last generated. */
  creationDate: string;
  /** Comma-separated verified domains to pre-fill when no link exists yet. */
  verifiedDomains: string;
};

export default {
  title: "Web/Organizations/Members/Invite Members Dialog/By Link Tab",
  component: ByLinkTabComponent,
  args: {
    hasExistingLink: false,
    allowedDomains: "example.com, acme.org",
    inviteLinkUrl:
      "https://vault.example.com/#/joinOrganization?organizationId=org-1&orgUserToken=abc123&orgName=Acme+Corp",
    creationDate: "2025-01-15T10:30:00Z",
    verifiedDomains: "",
  },
  argTypes: {
    hasExistingLink: {
      control: "boolean",
      description: "Toggles between the 'no link yet' callout state and the generated link view.",
    },
    allowedDomains: {
      control: "text",
      description:
        "Comma-separated allowed domains pre-filled in the input (applies when hasExistingLink is true).",
      if: { arg: "hasExistingLink" },
    },
    inviteLinkUrl: {
      control: "text",
      description: "The invite link URL shown in the read-only input.",
      if: { arg: "hasExistingLink" },
    },
    creationDate: {
      control: "text",
      description: "ISO 8601 date string shown in the 'Last generated' hint.",
      if: { arg: "hasExistingLink" },
    },
    verifiedDomains: {
      control: "text",
      description:
        "Comma-separated verified org domains that auto-fill the input when no link exists yet.",
      if: { arg: "hasExistingLink", truthy: false },
    },
  },
  decorators: [
    moduleMetadata({
      imports: [ByLinkTabComponent],
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

const render: Story["render"] = (args) => {
  const inviteLink = args.hasExistingLink
    ? Object.assign(new OrganizationInviteLink({} as any), {
        ...mockInviteLink,
        allowedDomains: args.allowedDomains.split(",").map((d) => d.trim()),
        creationDate: args.creationDate,
      })
    : undefined;

  const verifiedDomainNames = args.verifiedDomains
    ? args.verifiedDomains
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
    : [];

  return {
    moduleMetadata: {
      providers: [
        {
          provide: OrgDomainApiServiceAbstraction,
          useValue: {
            getAllByOrgId: () =>
              Promise.resolve(
                verifiedDomainNames.map((name, i) => ({
                  id: `domain-${i}`,
                  domainName: name,
                  verifiedDate: "2025-01-01T00:00:00Z",
                })),
              ),
          },
        },
        {
          provide: OrganizationInviteLinkService,
          useValue: {
            inviteLink$: () => of(inviteLink),
            reconstructUrl: () => of(args.hasExistingLink ? args.inviteLinkUrl : ""),
            createInviteLink: () => Promise.resolve(),
            updateInviteLink: () => Promise.resolve(),
            refreshInviteLink: () => Promise.resolve(),
            delete: () => Promise.resolve(),
          },
        },
      ],
    },
    template: `<app-by-link-tab organizationId="org-1"></app-by-link-tab>`,
  };
};

/**
 * Fresh state — callout prompts user to enter domains before generating a link.
 */
export const NoLinkYet: Story = {
  args: {
    hasExistingLink: false,
    verifiedDomains: "",
  },
  render,
};

/**
 * No link yet, but verified domains are pre-filled from the org's domain list.
 */
export const NoLinkWithVerifiedDomains: Story = {
  args: {
    hasExistingLink: false,
    verifiedDomains: "example.com, acme.org",
  },
  render,
};

/**
 * Link is generated — shows URL in disabled input with refresh + copy icon buttons and creation date hint.
 */
export const LinkExists: Story = {
  args: {
    hasExistingLink: true,
  },
  render,
};
