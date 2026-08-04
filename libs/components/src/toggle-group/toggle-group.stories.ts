import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BerryComponent } from "../berry";
import { CardComponent } from "../card";
import { I18nMockService } from "../utils/i18n-mock.service";

import { ToggleGroupComponent } from "./toggle-group.component";
import { ToggleComponent } from "./toggle.component";

export default {
  title: "Component Library/Toggle Group",
  component: ToggleGroupComponent,
  args: {
    selected: "all",
  },
  decorators: [
    moduleMetadata({
      imports: [BerryComponent, CardComponent, ToggleGroupComponent, ToggleComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({ selectPlaceholder: "-- Select --" }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=1881-17157&t=b5tDKylm5sWm2yKo-4",
    },
    a11y: {
      config: {
        rules: [
          {
            // axe cannot determine the background under label text because the
            // active-toggle indicator is rendered as an ::after pseudo-element
            // on the parent. Contrast is validated by the design tokens.
            id: "color-contrast",
            enabled: false,
          },
        ],
      },
    },
  },
} as Meta;

type Story = StoryObj<ToggleGroupComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-toggle-group [(selected)]="selected" label="People list filter">
        <bit-toggle value="all">
          All <bit-berry [value]="3" variant="danger"></bit-berry>
        </bit-toggle>

        <bit-toggle value="invited"> Invited </bit-toggle>

        <bit-toggle value="accepted">
          Accepted <bit-berry [value]="2" variant="danger"></bit-berry>
        </bit-toggle>

        <bit-toggle value="deactivated">
          Deactivated <bit-berry [value]="0" variant="danger"></bit-berry>
        </bit-toggle>
      </bit-toggle-group>
    `,
  }),
  args: {
    selected: "all",
  },
};

export const FullWidth: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-toggle-group [(selected)]="selected" label="People list filter" [fullWidth]="fullWidth">
        <bit-toggle value="all"> All <bit-berry [value]="3"></bit-berry> </bit-toggle>

        <bit-toggle value="invited"> Invited </bit-toggle>

        <bit-toggle value="accepted"> Accepted <bit-berry [value]="2"></bit-berry> </bit-toggle>

        <bit-toggle value="deactivated"> Deactivated </bit-toggle>
      </bit-toggle-group>
    `,
  }),
  args: {
    selected: "all",
    fullWidth: true,
  },
};

export const Inline: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-card>
        <bit-toggle-group [(selected)]="selected" label="People list filter" inline>
          <bit-toggle value="all"> All </bit-toggle>
          <bit-toggle value="invited"> Invited </bit-toggle>
          <bit-toggle value="accepted"> Accepted </bit-toggle>
        </bit-toggle-group>
      </bit-card>
    `,
  }),
  args: {
    selected: "all",
  },
};

export const UnsetSelection: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-toggle-group [(selected)]="selected" label="People list filter">
        <bit-toggle value="all"> All </bit-toggle>
        <bit-toggle value="invited"> Invited </bit-toggle>
        <bit-toggle value="accepted"> Accepted </bit-toggle>
        <bit-toggle value="deactivated"> Deactivated </bit-toggle>
      </bit-toggle-group>
    `,
  }),
  args: {
    selected: undefined,
  },
};

export const Overflow: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <p class="tw-text-sm tw-mb-2 tw-text-fg-muted">
        Resize the browser window to see inline → full-width → dropdown transitions.
      </p>
      <bit-toggle-group [(selected)]="selected" label="Status filter">
        <bit-toggle value="all">
          All<bit-berry [value]="3" variant="danger"></bit-berry>
        </bit-toggle>
        <bit-toggle value="invited">Invited</bit-toggle>
        <bit-toggle value="accepted">
          Accepted <bit-berry [value]="2" variant="danger"></bit-berry>
        </bit-toggle>
        <bit-toggle value="deactivated"> Deactivated</bit-toggle>
      </bit-toggle-group>
    `,
  }),
  args: {
    selected: "all",
  },
};
