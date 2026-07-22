import { ChangeDetectionStrategy, Component } from "@angular/core";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils";

import { FilterMenuModule } from "./filter-menu.module";

/**
 * Each chip declares a `key` and owns its own selection — no `ngModel`. Inside a
 * `bit-table-v2` the chips self-register with the table and their values land in
 * `table.filterValues()`; here they simply display their selection.
 */
@Component({
  selector: "filter-menu-demo",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuModule],
  template: `
    <div class="tw-flex tw-flex-wrap tw-items-start tw-gap-2 tw-p-4">
      <bit-filter-menu key="type" placeholderText="Type" unsetLabel="All">
        <bit-filter-option [value]="'login'" [count]="12">Login</bit-filter-option>
        <bit-filter-option [value]="'card'" [count]="3">Card</bit-filter-option>
        <bit-filter-option [value]="'note'" [count]="5">Secure note</bit-filter-option>
      </bit-filter-menu>

      <bit-filter-menu key="vault" placeholderText="Vault" multiple>
        <bit-filter-option [value]="'mine'" [count]="20">My vault</bit-filter-option>
        <bit-filter-option [value]="'acme'" [count]="11">Acme corporation</bit-filter-option>
      </bit-filter-menu>

      <bit-filter-menu key="collection" placeholderText="Collections" multiple>
        <bit-filter-section label="Engineering" collapsible>
          <bit-filter-option [value]="'cicd'" [count]="2">CI/CD</bit-filter-option>
          <bit-filter-option [value]="'devtools'" [count]="1">Dev tools</bit-filter-option>
        </bit-filter-section>
        <bit-filter-section label="Operations" collapsible>
          <bit-filter-option [value]="'support'" [count]="4">Support</bit-filter-option>
        </bit-filter-section>
      </bit-filter-menu>

      <bit-filter-toggle
        key="favorites"
        label="Favorites"
        icon="bwi-star"
        iconActive="bwi-star-f"
      ></bit-filter-toggle>
    </div>
  `,
})
class FilterMenuDemoComponent {}

export default {
  title: "Component Library/Filter Menu",
  decorators: [
    moduleMetadata({
      imports: [FilterMenuDemoComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              all: "All",
              removeItem: (name) => `Remove ${name}`,
              noMatchingItems: "No matching items",
              search: "Search",
              resetSearch: "Reset search",
              clear: "Clear",
            }),
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj;

/**
 * A single-select chip, a multi-select chip, a multi-select chip with sections,
 * and a toggle.
 */
export const Default: Story = {
  render: () => ({
    template: `<filter-menu-demo></filter-menu-demo>`,
  }),
};
