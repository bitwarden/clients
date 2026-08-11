import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService, ItemModule } from "@bitwarden/components";

import { RiskCategoryNavItemComponent } from "./risk-category-nav-item.component";

export default {
  title: "Browser/DIRT/Risk Category Nav Item",
  component: RiskCategoryNavItemComponent,
  decorators: [
    moduleMetadata({
      imports: [RouterTestingModule, ItemModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              exposedPasswordsNone: "No exposed passwords",
              exposedPassword: "1 exposed password",
              exposedPasswordsPlural: "__$1__ exposed passwords",
              exposedPasswordsDesc: "Exposed in data breaches",
              exposedPasswordsNoneDesc: "None of your passwords were found in data breaches",
              weakPasswordsNone: "No weak passwords",
              weakPassword: "1 weak password",
              weakPasswordsPlural: "__$1__ weak passwords",
              weakPasswordsDesc: "Too short or simple",
              weakPasswordsNoneDesc: "All your passwords are strong",
              reusedPasswordsNone: "No reused passwords",
              reusedPassword: "1 reused password",
              reusedPasswordsPlural: "__$1__ reused passwords",
              reusedPasswordsDesc: "Reused for several logins",
              reusedPasswordsNoneDesc: "All your passwords are unique",
              categoryHealthy: "No items need attention",
            }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/JZf3F2PRqB7HhflAybw2Xe/Premium-end-user-health?node-id=697-13275",
    },
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
  args: {
    labelKeyNone: "exposedPasswordsNone",
    labelKeySingular: "exposedPassword",
    labelKeyPlural: "exposedPasswordsPlural",
    descriptionKey: "exposedPasswordsDesc",
    descriptionKeyNone: "exposedPasswordsNoneDesc",
    count: 7,
    icon: "bwi-error",
    variant: "danger",
    route: "/health/exposed",
  },
  // The component renders the <a bit-item-content> only, so the wrapper supplies
  // the <bit-item> the row is designed to sit in.
  render: (args) => ({
    props: args,
    template: `
      <bit-item-group>
        <bit-item>
          <dirt-risk-category-nav-item
            [labelKeyNone]="labelKeyNone"
            [labelKeySingular]="labelKeySingular"
            [labelKeyPlural]="labelKeyPlural"
            [descriptionKey]="descriptionKey"
            [descriptionKeyNone]="descriptionKeyNone"
            [count]="count"
            [icon]="icon"
            [variant]="variant"
            [route]="route"
          />
        </bit-item>
      </bit-item-group>
    `,
  }),
} as Meta<RiskCategoryNavItemComponent>;

type Story = StoryObj<RiskCategoryNavItemComponent>;

/** At risk: a positive count, with the category's own icon and tile colour. */
export const AtRisk: Story = {};

/**
 * Healthy: the row still renders at a count of zero, with the "No …" title, the
 * absence-of-risk description, and a labelled check in place of the category icon.
 */
export const Healthy: Story = {
  args: {
    count: 0,
  },
};

/**
 * All three categories in one group. This is the arrangement the overview
 * renders, and the one that exercises `bit-item-group`'s corner rounding —
 * which only behaves correctly because the `bit-item` elements are true
 * siblings rather than each being wrapped in its own row component.
 */
export const AllCategories: Story = {
  render: () => ({
    template: `
      <bit-item-group>
        <bit-item>
          <dirt-risk-category-nav-item
            labelKeyNone="exposedPasswordsNone"
            labelKeySingular="exposedPassword"
            labelKeyPlural="exposedPasswordsPlural"
            descriptionKey="exposedPasswordsDesc"
            descriptionKeyNone="exposedPasswordsNoneDesc"
            [count]="7"
            icon="bwi-error"
            variant="danger"
            route="/health/exposed"
          />
        </bit-item>
        <bit-item>
          <dirt-risk-category-nav-item
            labelKeyNone="weakPasswordsNone"
            labelKeySingular="weakPassword"
            labelKeyPlural="weakPasswordsPlural"
            descriptionKey="weakPasswordsDesc"
            descriptionKeyNone="weakPasswordsNoneDesc"
            [count]="2"
            icon="bwi-warning"
            variant="warning"
            route="/health/weak"
          />
        </bit-item>
        <bit-item>
          <dirt-risk-category-nav-item
            labelKeyNone="reusedPasswordsNone"
            labelKeySingular="reusedPassword"
            labelKeyPlural="reusedPasswordsPlural"
            descriptionKey="reusedPasswordsDesc"
            descriptionKeyNone="reusedPasswordsNoneDesc"
            [count]="0"
            icon="bwi-refresh"
            variant="primary"
            route="/health/reused"
          />
        </bit-item>
      </bit-item-group>
    `,
  }),
};

/**
 * The clean state the design specifies: every category at zero, so all three
 * rows carry the "No …" title and a check tile.
 */
export const AllCategoriesHealthy: Story = {
  render: () => ({
    template: `
      <bit-item-group>
        <bit-item>
          <dirt-risk-category-nav-item
            labelKeyNone="exposedPasswordsNone"
            labelKeySingular="exposedPassword"
            labelKeyPlural="exposedPasswordsPlural"
            descriptionKey="exposedPasswordsDesc"
            descriptionKeyNone="exposedPasswordsNoneDesc"
            [count]="0"
            icon="bwi-error"
            variant="danger"
            route="/health/exposed"
          />
        </bit-item>
        <bit-item>
          <dirt-risk-category-nav-item
            labelKeyNone="weakPasswordsNone"
            labelKeySingular="weakPassword"
            labelKeyPlural="weakPasswordsPlural"
            descriptionKey="weakPasswordsDesc"
            descriptionKeyNone="weakPasswordsNoneDesc"
            [count]="0"
            icon="bwi-warning"
            variant="warning"
            route="/health/weak"
          />
        </bit-item>
        <bit-item>
          <dirt-risk-category-nav-item
            labelKeyNone="reusedPasswordsNone"
            labelKeySingular="reusedPassword"
            labelKeyPlural="reusedPasswordsPlural"
            descriptionKey="reusedPasswordsDesc"
            descriptionKeyNone="reusedPasswordsNoneDesc"
            [count]="0"
            icon="bwi-refresh"
            variant="primary"
            route="/health/reused"
          />
        </bit-item>
      </bit-item-group>
    `,
  }),
};
