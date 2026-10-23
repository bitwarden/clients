import { CommonModule } from "@angular/common";
import { importProvidersFrom } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogModule, I18nMockService, ToastModule } from "@bitwarden/components";
import { enabledFlags } from "@bitwarden/storybook";

import { AccessRequestsComponent } from "./access-requests.component";

/**
 * The full Access Requests page prototype — three tabs (Approvals / My
 * requests / History), each wired through to the live detail + withdraw
 * dialogs. Hover a row's trailing cell to reveal the Approve / Deny /
 * Revoke / Cancel / Activate / End session actions.
 */

const i18nMock = () =>
  new I18nMockService({
    loading: "Loading",
    close: "Close",
    back: "Back",
    more: "More",
    success: "Success",
    error: "Error",
    warning: "Warning",
    info: "Info",
    progressBar: "Progress bar",
    required: "required",
    inputRequired: "Input is required.",
    search: "Search",
    all: "All",
    clearFilter: "Clear filter",
    multiSelectPlaceholder: "-- Type to filter --",
    multiSelectLoading: "Retrieving options...",
    multiSelectNotFound: "No items found",
    multiSelectClearAll: "Clear all",
    // bit-table-v2 toolbar + filter-menu keys
    filter: "Filter",
    filters: "Filters",
    filtersSelected: "__$1__ selected",
    clear: "Clear",
    clearAll: "Clear all",
    clearSearch: "Clear search",
    done: "Done",
    customize: "Customize",
    customizeYourView: "Customize your view",
    showColumns: "Show columns",
    resetToDefault: "Reset to default",
    removeItem: "Remove __$1__",
    noFiltersMatchTerm: "No filters match “__$1__”",
    noMatchingItems: "No matching items",
    nothingToShow: "Nothing to show",
    itemCount: "__$1__ items",
    oneFilterResult: "1 result",
    filterResults: "__$1__ results",
    // bit-table-v2 pager keys
    rowsPerPage: "Rows per page",
    rowsPerPageOption: "__$1__",
    previousPage: "Previous page",
    nextPage: "Next page",
    goToPage: "Go to page",
    ofPageCount: "of __$1__",
    selectAllRows: "Select all rows",
    selectRow: "Select row",
  });

export default {
  title: "Prototypes/PAM/Access Requests Page",
  component: AccessRequestsComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, BrowserAnimationsModule, AccessRequestsComponent, ToastModule],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(DialogModule),
        ToastModule.forRoot().providers!,
        { provide: I18nService, useFactory: i18nMock },
        {
          provide: EnvironmentService,
          useValue: {
            environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }),
          },
        },
        {
          provide: DomainSettingsService,
          useValue: { showFavicons$: of(true) },
        },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: () => of(false) },
        },
      ],
    }),
  ],
  parameters: {
    layout: "fullscreen",
  },
} as Meta<AccessRequestsComponent>;

type Story = StoryObj<AccessRequestsComponent>;

export const Default: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: () => ({
    template: /* HTML */ `
      <div class="tw-p-6">
        <pam-access-requests></pam-access-requests>
      </div>
      <bit-toast-container></bit-toast-container>
    `,
  }),
};
