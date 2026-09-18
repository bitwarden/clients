import { ChangeDetectionStrategy, Component } from "@angular/core";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { expect, findByLabelText, getAllByRole, userEvent, waitFor, within } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { TOOLTIP_DELAY_MS } from "../tooltip";
import { I18nMockService } from "../utils";

import { FilterMenuModule } from "./filter-menu.module";
import { FilterOptionIconTile, FilterOptionNode } from "./filter-option.component";

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
  selector: "filter-menu-divider-demo",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuModule],
  template: `
    <div class="tw-flex tw-flex-wrap tw-items-start tw-gap-2 tw-p-4">
      <bit-filter-menu key="folder" placeholderText="My folders" multiple>
        <bit-filter-option [value]="null" [count]="5">No folders</bit-filter-option>
        <bit-filter-option-divider></bit-filter-option-divider>
        <bit-filter-option [value]="'entertainment'" [count]="5">Entertainment</bit-filter-option>
        <bit-filter-option [value]="'healthcare'" [count]="5">Healthcare</bit-filter-option>
        <bit-filter-option [value]="'social'" [count]="5">Social media</bit-filter-option>
        <bit-filter-option [value]="'work'" [count]="5">Work</bit-filter-option>
      </bit-filter-menu>
    </div>
  `,
})
class FilterMenuDividerDemoComponent {}

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
 * The same tree as {@link FilterMenuNestedDemoComponent}, built from data via `[options]` on the
 * menu instead of literal markup — the depth-unknown-ahead-of-time path a collection/folder tree
 * needs.
 */
@Component({
  selector: "filter-menu-data-driven-nested-demo",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuModule],
  template: `
    <div class="tw-flex tw-flex-wrap tw-items-start tw-gap-2 tw-p-4">
      <bit-filter-menu key="collection" placeholderText="Collections" multiple [options]="tree">
      </bit-filter-menu>
    </div>
  `,
})
class FilterMenuDataDrivenNestedDemoComponent {
  protected readonly tree: FilterOptionNode<string>[] = [
    {
      value: "eng",
      label: "Engineering",
      count: 15,
      options: [
        { value: "monitoring", label: "Monitoring", count: 20 },
        {
          value: "infra",
          label: "Infrastructure",
          count: 6,
          options: [{ value: "cicd", label: "CI/CD", count: 2 }],
        },
      ],
    },
    { value: "ops", label: "Operations", count: 3 },
  ];
}

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

/**
 * Names long enough to truncate on every row kind: a section header, a parent option, a
 * nested child, and (on the single-select chip) a flat row beside the injected "All".
 */
@Component({
  selector: "filter-menu-long-labels-demo",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuModule],
  template: `
    <div class="tw-flex tw-flex-wrap tw-items-start tw-gap-2 tw-p-4">
      <bit-filter-menu key="collection" placeholderText="Shared folders" multiple>
        <bit-filter-section label="Bitwarden Design System and Component Library" collapsible>
          <bit-filter-option [value]="'onboarding'" expanded>
            Onboarding materials for new design system contributors
            <bit-filter-option [value]="'tokens'">
              Design tokens, themes, and every palette we publish
            </bit-filter-option>
          </bit-filter-option>
        </bit-filter-section>
      </bit-filter-menu>

      <bit-filter-menu key="folder" placeholderText="My folders" unsetLabel="All">
        @for (folder of folders; track folder) {
          <bit-filter-option [value]="folder">{{ folder }}</bit-filter-option>
        }
      </bit-filter-menu>
    </div>
  `,
})
class FilterMenuLongLabelsDemoComponent {
  protected readonly folders = [
    "Household paperwork, warranties, and appliance manuals",
    "Streaming subscriptions I keep meaning to cancel",
  ];
}

@Component({
  selector: "filter-menu-disabled-reason-demo",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuModule],
  template: `
    <div class="tw-flex tw-flex-wrap tw-items-start tw-gap-2 tw-p-4">
      <bit-filter-toggle
        key="favorites"
        label="Favorites"
        icon="bwi-star"
        iconActive="bwi-star-f"
        disabled
        disabledTooltip="No favorites to show"
      ></bit-filter-toggle>

      <bit-filter-menu
        key="sharedFolder"
        placeholderText="Shared folders"
        multiple
        disabled
        disabledTooltip="No shared folders to show"
      ></bit-filter-menu>
    </div>
  `,
})
class FilterMenuDisabledReasonDemoComponent {}

export default {
  title: "Component Library/Filter Menu",
  decorators: [
    moduleMetadata({
      imports: [
        FilterMenuDemoComponent,
        FilterMenuDividerDemoComponent,
        FilterMenuNestedDemoComponent,
        FilterMenuDataDrivenNestedDemoComponent,
        FilterMenuNestedTilesDemoComponent,
        FilterMenuEmptyDemoComponent,
        FilterMenuLongLabelsDemoComponent,
        FilterMenuDisabledReasonDemoComponent,
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
              noFiltersMatchTerm: (term) => `No filters match \u201c${term}\u201d`,
              clearSearch: "Clear search",
              oneFilterResult: "1 result",
              filterResults: (count) => `${count} results`,
              search: "Search",
              resetSearch: "Reset search",
              clearSearchTooltip: "Clear by clicking here or pressing Esc.",
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
 * The same tree as {@link NestedOptions}, built from data via `[options]` on the menu instead of
 * literal markup — for a tree whose depth isn't known ahead of time, like a collection or folder
 * list.
 */
export const DataDrivenNestedOptions: Story = {
  render: () => ({
    template: `<filter-menu-data-driven-nested-demo></filter-menu-data-driven-nested-demo>`,
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

/**
 * `bit-filter-option-divider` separates runs of options. The popover draws a rule; the
 * responsive dialog starts a new card instead, so the groups read as separate cards.
 */
export const OptionDividers: Story = {
  render: () => ({
    template: `<filter-menu-divider-demo></filter-menu-divider-demo>`,
  }),
  play: async (context) => {
    const [trigger] = getAllByRole(context.canvasElement, "button");
    await userEvent.click(trigger);
  },
};

/**
 * A label longer than its row truncates rather than wraps, so every row carries a tooltip with
 * the full text: the section header, the parent option, and the nested child. The story hovers
 * the first row and waits out the delay, so the tooltip is up alongside the rows it explains.
 * The chip trigger truncates too, but carries no tooltip of its own.
 */
export const LongLabels: Story = {
  render: () => ({
    template: `<filter-menu-long-labels-demo></filter-menu-long-labels-demo>`,
  }),
  play: async (context) => {
    // The rows only exist while the menu is open.
    await userEvent.click(getAllByRole(context.canvasElement, "button")[0]);

    // The rows render into the CDK overlay, outside the story canvas.
    const [firstRow] = await within(document.body).findAllByRole("treeitem");
    await userEvent.hover(firstRow);

    // The overlay attaches on hover but stays invisible until the delay elapses, so wait for
    // the visible state rather than the element.
    await waitFor(
      () =>
        expect(
          document.querySelector('.bit-tooltip-container[data-visible="true"]'),
        ).not.toBeNull(),
      { timeout: TOOLTIP_DELAY_MS + 2000 },
    );
  },
};

/**
 * The same long names on a single-select chip: flat option rows, plus the auto-injected "All"
 * row, which is tooltipped from `unsetLabel` for the consumer who passes a long one.
 */
export const LongLabelsSingleSelect: Story = {
  render: () => ({
    template: `<filter-menu-long-labels-demo></filter-menu-long-labels-demo>`,
  }),
  play: async (context) => {
    // The second chip is the single-select one.
    await userEvent.click(getAllByRole(context.canvasElement, "button")[1]);
  },
};

export const DisabledReason: Story = {
  render: () => ({
    template: `<filter-menu-disabled-reason-demo></filter-menu-disabled-reason-demo>`,
  }),
  play: async (context) => {
    const [favorites] = getAllByRole(context.canvasElement, "button");

    await userEvent.hover(favorites);

    await waitFor(
      () =>
        expect(
          document.querySelector('.bit-tooltip-container[data-visible="true"]'),
        ).not.toBeNull(),
      { timeout: TOOLTIP_DELAY_MS + 2000 },
    );

    const describedBy = favorites.getAttribute("aria-describedby");
    await expect(describedBy).not.toBeNull();
    await expect(document.getElementById(describedBy!)).toHaveTextContent("No favorites to show");
  },
  parameters: {
    // test is flaky, muting for now
    chromatic: { disableSnapshot: true },
  },
};
