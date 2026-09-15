import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
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
    invite: "enc-key",
    supportsConfirmation: true,
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

const mockEventCollectionService = {
  collect: () => Promise.resolve(),
  collectMany: () => Promise.resolve(),
};

const mockInviteLinkUrl =
  "https://vault.example.com/#/joinOrganization?organizationId=org-1&orgUserToken=abc123&orgName=Acme+Corp";

type StoryArgs = {
  /** Comma-separated verified domains to pre-fill when no link exists yet. */
  verifiedDomains: string;
  /** Whether `pm-34429-invite-link-auto-confirm` is on, which is what reveals the switch. */
  autoConfirmEnabled: boolean;
};

export default {
  title: "Admin Console/Organizations/Members/Invite Members Dialog/By Link Tab",
  component: ByLinkTabComponent,
  args: {
    verifiedDomains: "",
    autoConfirmEnabled: true,
  },
  argTypes: {
    verifiedDomains: {
      control: "text",
      description:
        "Comma-separated verified org domains that auto-fill the input when no link exists yet.",
    },
    autoConfirmEnabled: {
      control: "boolean",
      description:
        "Whether the pm-34429-invite-link-auto-confirm flag is on. The 'require admin confirmation' switch only renders when it is, and only once a link exists.",
    },
  },
  decorators: [
    moduleMetadata({
      imports: [ByLinkTabComponent],
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: ToastService, useValue: mockToastService },
        { provide: EventCollectionService, useValue: mockEventCollectionService },
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

    const patchLink = (patch: Partial<OrganizationInviteLink>) => {
      const current = inviteLink$.getValue();
      inviteLink$.next(
        Object.assign(new OrganizationInviteLink({} as any), {
          ...mockInviteLink,
          creationDate: current?.creationDate ?? new Date().toISOString(),
          supportsConfirmation:
            current?.supportsConfirmation ?? mockInviteLink.supportsConfirmation,
          ...patch,
        }),
      );
      return Promise.resolve();
    };

    const upsertLink = (_userId: unknown, _orgId: unknown, domains: string[]) =>
      patchLink({ allowedDomains: domains });

    return {
      moduleMetadata: {
        providers: [
          {
            provide: ConfigService,
            useValue: {
              getFeatureFlag$: () => of(args.autoConfirmEnabled),
            },
          },
          {
            provide: ValidationService,
            useValue: { showError: () => {} },
          },
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
              createInviteLink: (
                _userId: unknown,
                _orgId: unknown,
                domains: string[],
                supportsConfirmation: boolean,
              ) => patchLink({ allowedDomains: domains, supportsConfirmation }),
              updateAllowedDomains: upsertLink,
              setInviteConfirmation: (
                _userId: unknown,
                _orgId: unknown,
                supportsConfirmation: boolean,
              ) => patchLink({ supportsConfirmation }),
              refreshInviteLink: (
                _userId: unknown,
                _orgId: unknown,
                supportsConfirmation: boolean,
              ) => patchLink({ supportsConfirmation }),
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
 *
 * `supportsConfirmation: true` is the link-confirm flow, so the switch reads as off.
 */
export const LinkExists: Story = {
  args: {},
  render: makeRender(mockInviteLink),
};

/**
 * An existing link on the accept flow (`supportsConfirmation: false`), so the switch reads as on
 * and invitees wait on an admin.
 */
export const LinkRequiringAdminConfirmation: Story = {
  args: {},
  render: makeRender(
    Object.assign(new OrganizationInviteLink({} as any), {
      ...mockInviteLink,
      supportsConfirmation: false,
    }),
  ),
};

/**
 * Flag off — the switch is absent and links keep being created without confirmation support.
 */
export const LinkExistsWithFlagOff: Story = {
  args: {
    autoConfirmEnabled: false,
  },
  render: makeRender(mockInviteLink),
};
