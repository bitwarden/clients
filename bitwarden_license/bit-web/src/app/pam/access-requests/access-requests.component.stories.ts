import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { ApproverInboxService } from "../approvals/approver-inbox.service";
import {
  provideStoryChangeDetection,
  provideStoryLogService,
  provideStoryWebHeader,
} from "../testing/story-fixtures";

import { AccessRequestsComponent } from "./access-requests.component";
import { MyAccessService } from "./my-access.service";

type ShellOptions = {
  pending?: number;
  extensions?: number;
  leases?: number;
  approvals?: number;
  canApprove?: boolean;
};

/**
 * The shell renders the header and the tab nav; the tabs are child routes, so the outlet is empty
 * here by design. What these stories pin is the tab nav — which tabs exist, and their berry counts.
 *
 * `AccountService`/`OrganizationService` go in the ROOT injector rather than the module one: the
 * shared web header's `ProductSwitcherService` is `providedIn: "root"` and resolves them from the
 * environment injector, so a module-level provider is invisible to it.
 */
function shell(options: ShellOptions = {}) {
  const { pending = 0, extensions = 0, leases = 0, approvals = 0, canApprove = true } = options;
  const rows = (count: number) => of(Array.from({ length: count }, (_, i) => ({ id: `row-${i}` })));

  return [
    moduleMetadata({
      imports: [AccessRequestsComponent],
      providers: [
        {
          provide: MyAccessService,
          useValue: {
            pendingRows$: rows(pending),
            extensionRows$: rows(extensions),
            leases$: rows(leases),
            loadError$: of(null),
            load: () => Promise.resolve(),
          },
        },
        {
          provide: ApproverInboxService,
          useValue: {
            pendingCount$: of(approvals),
            loadError$: of(null),
            load: () => Promise.resolve(),
          },
        },
        { provide: ToastService, useValue: { showToast: () => {} } },
      ],
    }),
    applicationConfig({
      providers: [
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: OrganizationService,
          useValue: { organizations$: () => of([{ canManageAccessRules: canApprove }]) },
        },
      ],
    }),
  ];
}

export default {
  title: "Web/PAM/Access Requests/Shell",
  component: AccessRequestsComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        // A wildcard route: the header nav resolves its links against the router, and the bare
        // `iframe.html` URL matches nothing in an empty route table (NG04002).
        importProvidersFrom(RouterModule.forRoot([{ path: "**", children: [] }])),
        provideStoryLogService(),
        ...provideStoryWebHeader(),
      ],
    }),
  ],
  render: () => ({ template: `<pam-access-requests />` }),
} as Meta<AccessRequestsComponent>;

type Story = StoryObj<AccessRequestsComponent>;

/**
 * An approver with work on every tab. The My requests berry sums pending requests, open extension
 * requests and active leases — everything the caller still holds or can act on.
 */
export const Default: Story = {
  decorators: shell({ pending: 2, extensions: 1, leases: 3, approvals: 4 }),
};

/** Nothing anywhere: a zero count renders no berry rather than a "0". */
export const NoCounts: Story = {
  decorators: shell(),
};

/**
 * A member with no approval privileges. The Approvals tab is not rendered at all — a tab that can
 * never hold anything is noise, and the route guard redirects the deep link to match.
 */
export const WithoutApprovals: Story = {
  decorators: shell({ canApprove: false, pending: 1, leases: 1 }),
};
