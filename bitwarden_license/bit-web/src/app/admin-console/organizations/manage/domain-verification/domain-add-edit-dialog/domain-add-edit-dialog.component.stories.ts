import { importProvidersFrom } from "@angular/core";
import { provideRouter } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { action } from "storybook/actions";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrgDomainServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain.service.abstraction";
import { OrganizationDomainResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/organization-domain.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogRef, DIALOG_DATA, DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import {
  DomainAddEditDialogComponent,
  DomainAddEditDialogData,
} from "./domain-add-edit-dialog.component";

const ORG_ID = "org-story-1";

const pendingDomain = new OrganizationDomainResponse({
  id: "domain-1",
  organizationId: ORG_ID,
  txt: "bw=abc123",
  domainName: "example.com",
  creationDate: "2026-01-01T00:00:00.000Z",
  nextRunDate: "2026-01-02T00:00:00.000Z",
  jobRunCount: 1,
  lastCheckedDate: "2026-01-01T12:00:00.000Z",
});

const claimedDomain = new OrganizationDomainResponse({
  ...pendingDomain,
  id: "domain-2",
  domainName: "claimed.example.com",
  verifiedDate: "2026-01-05T00:00:00.000Z",
});

/** Per-story dialog data plus the API stubs the dialog calls into. */
function storyProviders(data: DomainAddEditDialogData) {
  return applicationConfig({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      {
        provide: OrgDomainApiServiceAbstraction,
        useValue: {
          post: async () => pendingDomain,
          verify: async () => data.orgDomain ?? pendingDomain,
          getByOrgIdAndOrgDomainId: async () => data.orgDomain ?? pendingDomain,
          delete: async () => {},
        },
      },
    ],
  });
}

export default {
  title: "Admin Console/Organizations/Domain Add-Edit Dialog",
  component: DomainAddEditDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [DomainAddEditDialogComponent],
      providers: [
        { provide: DialogRef, useValue: { close: action("DialogRef.close") } },
        {
          provide: OrgDomainServiceAbstraction,
          useValue: { copyDnsTxt: action("OrgDomainService.copyDnsTxt") },
        },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: () => of(false),
          },
        },
        {
          provide: DialogService,
          useValue: { openSimpleDialog: async () => true },
        },
        {
          provide: ValidationService,
          useValue: { showError: action("ValidationService.showError") },
        },
        {
          provide: ToastService,
          useValue: { showToast: action("ToastService.showToast") },
        },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule), provideRouter([])],
    }),
  ],
} satisfies Meta<DomainAddEditDialogComponent>;

type Story = StoryObj<DomainAddEditDialogComponent>;

/** Adding a brand new domain — the domain name field is editable. */
export const Add: Story = {
  decorators: [
    // orgDomain is null when creating a new domain; the field's type doesn't reflect this
    // (see domain-add-edit-dialog.component.ts, which relies on @ts-strict-ignore for the same call).
    storyProviders({
      organizationId: ORG_ID,
      orgDomain: null as unknown as OrganizationDomainResponse,
      existingDomainNames: [],
    }),
  ],
};

/** An existing domain still pending DNS verification. */
export const Pending: Story = {
  decorators: [
    storyProviders({
      organizationId: ORG_ID,
      orgDomain: pendingDomain,
      existingDomainNames: [pendingDomain.domainName],
    }),
  ],
};

/** An existing domain that has already been claimed. */
export const Claimed: Story = {
  decorators: [
    storyProviders({
      organizationId: ORG_ID,
      orgDomain: claimedDomain,
      existingDomainNames: [claimedDomain.domainName],
    }),
  ],
};
