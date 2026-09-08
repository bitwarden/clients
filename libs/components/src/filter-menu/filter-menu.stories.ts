import { ChangeDetectionStrategy, Component } from "@angular/core";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { findByLabelText, getAllByRole, userEvent } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils";

import { FilterMenuModule } from "./filter-menu.module";
import { FilterOptionIconTile } from "./filter-option.component";

/**
 * Each chip declares a `key` and owns its own selection — no `ngModel`. Inside a
 * `bit-table-v2` the chips self-register and their values land in `table.filterValues()`.
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

/**
 * Nine rows alternating individual and group, each group opening the next level down.
 */
@Component({
  selector: "filter-menu-nested-tiles-demo",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuModule],
  template: `
    <div class="tw-flex tw-flex-wrap tw-items-start tw-gap-2 tw-p-4">
      <bit-filter-menu key="collection" placeholderText="Collections" multiple>
        <bit-filter-option [value]="'individual-1'" [count]="456" [iconTile]="tile">
          Item label
        </bit-filter-option>
        <bit-filter-option [value]="'group-1'" [count]="456" [iconTile]="tile" expanded>
          Item label
          <bit-filter-option [value]="'individual-2'" [count]="456" [iconTile]="tile">
            Item label
          </bit-filter-option>
          <bit-filter-option [value]="'group-2'" [count]="456" [iconTile]="tile" expanded>
            Item label
            <bit-filter-option [value]="'individual-3'" [count]="456" [iconTile]="tile">
              Item label
            </bit-filter-option>
            <bit-filter-option [value]="'group-3'" [count]="456" [iconTile]="tile" expanded>
              Item label
              <bit-filter-option [value]="'individual-4'" [count]="456" [iconTile]="tile">
                Item label
              </bit-filter-option>
              <bit-filter-option [value]="'group-4'" [count]="456" [iconTile]="tile" expanded>
                Item label
                <bit-filter-option [value]="'individual-5'" [count]="456" [iconTile]="tile">
                  Item label
                </bit-filter-option>
              </bit-filter-option>
            </bit-filter-option>
          </bit-filter-option>
        </bit-filter-option>
      </bit-filter-menu>
    </div>
  `,
})
class FilterMenuNestedTilesDemoComponent {
  protected readonly tile: FilterOptionIconTile = { icon: "bwi-clock", variant: "brand" };
}

/** Enough options to bring out the in-menu search. */
@Component({
  selector: "filter-menu-empty-demo",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuModule],
  template: `
    <div class="tw-flex tw-flex-wrap tw-items-start tw-gap-2 tw-p-4">
      <bit-filter-menu key="collection" placeholderText="Collections" multiple>
        @for (name of names; track name) {
          <bit-filter-option [value]="name" [count]="3">{{ name }}</bit-filter-option>
        }
      </bit-filter-menu>
    </div>
  `,
})
class FilterMenuEmptyDemoComponent {
  protected readonly names = [
    "Engineering",
    "Operations",
    "Project management",
    "Security",
    "Design",
    "Marketing",
    "Sales",
    "Finance",
    "Legal",
    "Support",
    "Research",
    "Facilities",
  ];
}

export default {
  title: "Component Library/Filter Menu",
  decorators: [
    moduleMetadata({
      imports: [
        FilterMenuDemoComponent,
        FilterMenuNestedDemoComponent,
        FilterMenuNestedTilesDemoComponent,
        FilterMenuEmptyDemoComponent,
        FilterMenuModule,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              all: "All",
              removeItem: (name) => `Remove ${name}`,
              noMatchingItems: "No matching items",
              noFiltersMatch: (term) => `No filters match "${term}"`,
              clearSearch: "Clear search",
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
 * Options can render a leading icon tile. The chip forces `size="xs"`; a disabled option's
 * tile drops to `gray`.
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
 * Selecting a parent selects everything beneath it; a partly selected subtree draws
 * indeterminate up every level. Searching keeps a parent visible while a child matches.
 */
export const NestedOptions: Story = {
  render: () => ({
    template: `<filter-menu-nested-demo></filter-menu-nested-demo>`,
  }),
};

/**
 * Nested options with a leading icon tile on every row. Leaves reserve the chevron's
 * column, so the tiles line up at each level.
 */
export const NestedIconTiles: Story = {
  render: () => ({
    template: `<filter-menu-nested-tiles-demo></filter-menu-nested-tiles-demo>`,
  }),
  play: async (context) => {
    // The rows only exist while the menu is open, so open it for the snapshot.
    const [trigger] = getAllByRole(context.canvasElement, "button");
    await userEvent.click(trigger);
  },
};

/**
 * No option matches the search term. The in-menu search needs more than ten options.
 */
export const NoMatchingItems: Story = {
  render: () => ({
    template: `<filter-menu-empty-demo></filter-menu-empty-demo>`,
  }),
  play: async (context) => {
    const [trigger] = getAllByRole(context.canvasElement, "button");
    await userEvent.click(trigger);
    // The popover renders into the CDK overlay, outside the story canvas.
    const search = await findByLabelText(document.body, "Search");
    await userEvent.type(search, "zzz");
  },
};
