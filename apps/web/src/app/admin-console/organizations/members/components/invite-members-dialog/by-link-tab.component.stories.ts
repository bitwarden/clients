import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

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

export default {
  title: "Web/Organizations/Members/Invite Members Dialog/By Link Tab",
  component: ByLinkTabComponent,
  args: {
    hasLink: true,
    inviteLinkUrl:
      "https://vault.example.com/#/joinOrganization?organizationId=org-1&orgUserToken=abc123&orgName=Acme+Corp",
  },
  argTypes: {
    hasLink: {
      name: "hasLink",
      control: "boolean",
      description: "Whether an invite link has been generated. Hides the callout when true.",
      table: { category: "properties" },
    },
    inviteLinkUrl: {
      name: "inviteLinkUrl",
      control: "text",
      description: "The shareable invite link URL shown in the read-only input.",
      table: { category: "properties" },
    },
    copyLink: { control: false, table: { type: { summary: "() => Promise<void>" } } },
    form: { control: false, table: { type: { summary: "FormGroup" } } },
    organizationId: { control: false, table: { type: { summary: "InputSignal<OrganizationId>" } } },
    refreshLink: { control: false, table: { type: { summary: "() => Promise<void>" } } },
    save: { control: false, table: { type: { summary: "() => Promise<void>" } } },
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
} as Meta;

type Story = StoryObj<{ hasLink: boolean; inviteLinkUrl: string }>;

const render: Story["render"] = (args) => ({
  props: args,
  moduleMetadata: {
    providers: [
      {
        provide: OrganizationInviteLinkService,
        useValue: {
          inviteLink$: () => of(args["hasLink"] ? mockInviteLink : undefined),
          reconstructUrl: () => of(args["inviteLinkUrl"] ?? ""),
          createInviteLink: () => Promise.resolve(),
          updateInviteLink: () => Promise.resolve(),
          refreshInviteLink: () => Promise.resolve(),
        },
      },
    ],
  },
  template: `<app-by-link-tab organizationId="org-1"></app-by-link-tab>`,
});

/**
 * Fresh state — callout prompts user to enter domains before generating a link.
 */
export const NoLinkYet: Story = {
  args: {
    hasLink: false,
    inviteLinkUrl:
      "https://vault.example.com/#/joinOrganization?organizationId=org-1&orgUserToken=abc123&orgName=Acme+Corp",
  },
  render,
};

/**
 * Link is generated — shows URL in disabled input with refresh + copy icon buttons and creation date hint.
 */
export const LinkExists: Story = {
  args: {
    hasLink: true,
    inviteLinkUrl:
      "https://vault.example.com/#/joinOrganization?organizationId=org-1&orgUserToken=abc123&orgName=Acme+Corp",
  },
  render,
};
