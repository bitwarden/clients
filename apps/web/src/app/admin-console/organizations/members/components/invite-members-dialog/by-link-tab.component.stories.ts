import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

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

const mockInviteLinkUrl =
  "https://vault.example.com/#/joinOrganization?organizationId=org-1&orgUserToken=abc123&orgName=Acme+Corp";

type StoryArgs = {
  /** Comma-separated verified domains to pre-fill when no link exists yet. */
  verifiedDomains: string;
};

export default {
  title: "Admin Console/Organizations/Members/Invite Members Dialog/By Link Tab",
  component: ByLinkTabComponent,
  args: {
    verifiedDomains: "",
  },
  argTypes: {
    verifiedDomains: {
      control: "text",
      description:
        "Comma-separated verified org domains that auto-fill the input when no link exists yet.",
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

const makeRender =
  (initialLink: OrganizationInviteLink | undefined): Story["render"] =>
  (args) => {
    const inviteLink$ = new BehaviorSubject<OrganizationInviteLink | undefined>(initialLink);

    const verifiedDomainNames = args.verifiedDomains
      ? args.verifiedDomains
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean)
      : [];

    const upsertLink = (_userId: unknown, _orgId: unknown, domains: string[]) => {
      const current = inviteLink$.getValue();
      inviteLink$.next(
        Object.assign(new OrganizationInviteLink({} as any), {
          ...mockInviteLink,
          allowedDomains: domains,
          creationDate: current?.creationDate ?? new Date().toISOString(),
        }),
      );
      return Promise.resolve();
    };

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
              inviteLink$: () => inviteLink$.asObservable(),
              reconstructUrl: () => of(mockInviteLinkUrl),
              createInviteLink: upsertLink,
              updateInviteLink: upsertLink,
              refreshInviteLink: () => Promise.resolve(),
              delete: () => {
                inviteLink$.next(undefined);
                return Promise.resolve();
              },
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
    verifiedDomains: "",
  },
  render: makeRender(undefined),
};

/**
 * No link yet, but verified domains are pre-filled from the org's domain list.
 */
export const NoLinkWithVerifiedDomains: Story = {
  args: {
    verifiedDomains: "example.com, acme.org",
  },
  render: makeRender(undefined),
};

/**
 * Link is generated — shows URL in disabled input with refresh + copy icon buttons and creation date hint.
 */
export const LinkExists: Story = {
  args: {},
  render: makeRender(mockInviteLink),
};
