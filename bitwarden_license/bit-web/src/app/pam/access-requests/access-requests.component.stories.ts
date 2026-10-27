import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

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
};

/**
 * The tabs are child routes, so the outlet stays empty; these stories cover the tab nav and its
 * berry counts.
 */
function shell(options: ShellOptions = {}) {
  const { pending = 0, extensions = 0, leases = 0 } = options;
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
        { provide: ToastService, useValue: { showToast: () => {} } },
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
        // A wildcard route, since the header resolves its links against the router and the bare
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

/** Work in every section; the My requests berry sums all three. */
export const Default: Story = {
  decorators: shell({ pending: 2, extensions: 1, leases: 3 }),
};

/** Nothing anywhere: a zero count renders no berry rather than a "0". */
export const NoCounts: Story = {
  decorators: shell(),
};
