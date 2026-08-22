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

/**
 * Options nest by projection: put `bit-filter-option`s inside one to make it an
 * expandable parent.
 *
 * Projection and content queries are both static relative to where a template is
 * declared, so nesting is spelled out in markup (literally, or with an inline
 * `@for` per level) rather than recursed through `ngTemplateOutlet` — depth is
 * whatever the template writes out.
 */
@Component({
  selector: "filter-menu-nested-demo",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuModule],
  template: `
    <div class="tw-flex tw-flex-wrap tw-items-start tw-gap-2 tw-p-4">
      <bit-filter-menu key="collection" placeholderText="Collections" multiple>
        <bit-filter-option [value]="'eng'" [count]="15" expanded>
          Engineering
          <bit-filter-option [value]="'monitoring'" [count]="20">Monitoring</bit-filter-option>
          <bit-filter-option [value]="'infra'" [count]="6">
            Infrastructure
            <bit-filter-option [value]="'cicd'" [count]="2">CI/CD</bit-filter-option>
          </bit-filter-option>
        </bit-filter-option>
        <bit-filter-option [value]="'ops'" [count]="3">Operations</bit-filter-option>
      </bit-filter-menu>

      <bit-filter-menu key="folder" placeholderText="My folders" multiple>
        <bit-filter-option [value]="'work'" [count]="9">
          Work
          <bit-filter-option [value]="'clients'" [count]="4">Clients</bit-filter-option>
        </bit-filter-option>
        <bit-filter-option [value]="'personal'" [count]="5">Personal</bit-filter-option>
      </bit-filter-menu>
    </div>
  `,
})
class FilterMenuNestedDemoComponent {}

export default {
  title: "Component Library/Filter Menu",
  decorators: [
    moduleMetadata({
      imports: [FilterMenuDemoComponent, FilterMenuNestedDemoComponent, FilterMenuModule],
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
              filtersSelected: (count) => `${count} selected`,
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

/**
 * Options can render a leading icon tile. The chip forces `size="xs"` so every row lines up, and a
 * disabled option's tile drops to the neutral `gray` family.
 */
export const IconTiles: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-flex tw-flex-wrap tw-items-start tw-gap-2 tw-p-4">
        <bit-filter-menu key="type" placeholderText="Type" multiple>
          <bit-filter-option [value]="'login'" [count]="12" [iconTile]="{ icon: 'bwi-globe', variant: 'brand' }">Login</bit-filter-option>
          <bit-filter-option [value]="'card'" [count]="3" [iconTile]="{ icon: 'bwi-credit-card', variant: 'teal' }">Card</bit-filter-option>
          <bit-filter-option [value]="'identity'" [iconTile]="{ icon: 'bwi-id-card', variant: 'purple', emphasis: 'bold' }">Identity</bit-filter-option>
          <bit-filter-option [value]="'note'" [iconTile]="{ icon: 'bwi-sticky-note', color: '#f8e71c' }">Note with a custom color</bit-filter-option>
          <bit-filter-option [value]="'sshKey'" [iconTile]="{ icon: 'bwi-key', variant: 'green' }" disabled>SSH key</bit-filter-option>
        </bit-filter-menu>
      </div>
    `,
  }),
};

/**
 * Nested options. Selecting a parent selects everything beneath it; clearing it
 * clears the same set. A parent whose subtree is only partly selected draws
 * indeterminate, and that propagates up through every level — uncheck CI/CD and
 * both Infrastructure and Engineering go indeterminate.
 *
 * Searching keeps a parent visible while anything beneath it matches, so a nested
 * match is reachable through its ancestors instead of being hidden with them.
 */
export const NestedOptions: Story = {
  render: () => ({
    template: `<filter-menu-nested-demo></filter-menu-nested-demo>`,
  }),
};
