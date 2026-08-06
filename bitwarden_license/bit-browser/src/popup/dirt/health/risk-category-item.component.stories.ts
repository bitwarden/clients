import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService, ItemModule } from "@bitwarden/components";

import { RiskCategoryItemComponent } from "./risk-category-item.component";

export default {
  title: "Browser/DIRT/Risk Category Item",
  component: RiskCategoryItemComponent,
  decorators: [
    moduleMetadata({
      imports: [RouterTestingModule, ItemModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              exposedPasswords: "Exposed passwords",
              exposedPasswordsDesc: "Exposed in data breaches",
              weakPasswords: "Weak passwords",
              weakPasswordsDesc: "Too short or simple",
              reusedPasswords: "Reused passwords",
              reusedPasswordsDesc: "Reused for several logins",
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
    labelKey: "exposedPasswords",
    descriptionKey: "exposedPasswordsDesc",
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
          <dirt-risk-category-item
            [labelKey]="labelKey"
            [descriptionKey]="descriptionKey"
            [count]="count"
            [icon]="icon"
            [variant]="variant"
            [route]="route"
          />
        </bit-item>
      </bit-item-group>
    `,
  }),
} as Meta<RiskCategoryItemComponent>;

type Story = StoryObj<RiskCategoryItemComponent>;

/** At risk: a positive count, no checkmark. */
export const AtRisk: Story = {};

/** Healthy: a count of zero still renders, with a labelled checkmark. */
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
          <dirt-risk-category-item
            labelKey="exposedPasswords"
            descriptionKey="exposedPasswordsDesc"
            [count]="7"
            icon="bwi-error"
            variant="danger"
            route="/health/exposed"
          />
        </bit-item>
        <bit-item>
          <dirt-risk-category-item
            labelKey="weakPasswords"
            descriptionKey="weakPasswordsDesc"
            [count]="2"
            icon="bwi-warning"
            variant="warning"
            route="/health/weak"
          />
        </bit-item>
        <bit-item>
          <dirt-risk-category-item
            labelKey="reusedPasswords"
            descriptionKey="reusedPasswordsDesc"
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
