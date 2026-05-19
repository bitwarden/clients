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

const mockInviteLinkServiceNoLink = {
  inviteLink$: () => of(undefined),
  reconstructUrl: () => of(undefined),
  createInviteLink: () => Promise.resolve(),
  updateInviteLink: () => Promise.resolve(),
  refreshInviteLink: () => Promise.resolve(),
};

const mockInviteLinkServiceWithLink = {
  inviteLink$: () => of(mockInviteLink),
  reconstructUrl: () => of("https://vault.bitwarden.com/#/join/org-1?key=XYZ"),
  createInviteLink: () => Promise.resolve(),
  updateInviteLink: () => Promise.resolve(),
  refreshInviteLink: () => Promise.resolve(),
};

export default {
  title: "Web/Organizations/Members/Invite Members Dialog/By Link Tab",
  component: ByLinkTabComponent,
  argTypes: {
    copyLink: { control: false, table: { type: { summary: "() => Promise<void>" } } },
    form: { control: false, table: { type: { summary: "FormGroup" } } },
    hasInviteLinkUrl$: { control: false, table: { type: { summary: "Observable<boolean>" } } },
    inviteLink$: {
      control: false,
      table: {
        type: { summary: "Observable<OrganizationInviteLink | undefined>" },
        category: "properties",
      },
    },
    inviteLinkUrl$: {
      control: false,
      table: { type: { summary: "Observable<string>" }, category: "properties" },
    },
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
} as Meta<ByLinkTabComponent>;

type Story = StoryObj<ByLinkTabComponent>;

/**
 * Fresh state — callout prompts user to enter domains before generating a link.
 */
export const NoLinkYet: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        { provide: OrganizationInviteLinkService, useValue: mockInviteLinkServiceNoLink },
      ],
    }),
  ],
  render: (args) => ({
    props: args,
    template: `<app-by-link-tab organizationId="org-1"></app-by-link-tab>`,
  }),
};

/**
 * Link is generated — shows URL in disabled input with refresh + copy icon buttons and creation date hint.
 */
export const LinkExists: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        { provide: OrganizationInviteLinkService, useValue: mockInviteLinkServiceWithLink },
      ],
    }),
  ],
  render: (args) => ({
    props: args,
    template: `<app-by-link-tab organizationId="org-1"></app-by-link-tab>`,
  }),
};
