import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconButtonModule } from "../icon-button";
import { LinkModule } from "../link";
import { MenuModule } from "../menu";
import { I18nMockService } from "../utils";

import { BreadcrumbComponent } from "./breadcrumb.component";
import { BreadcrumbsComponent } from "./breadcrumbs.component";

@Component({
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class EmptyComponent {}

export default {
  title: "Component Library/Breadcrumbs",
  component: BreadcrumbsComponent,
  decorators: [
    moduleMetadata({
      imports: [LinkModule, MenuModule, IconButtonModule, RouterModule, BreadcrumbComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              moreBreadcrumbs: "More breadcrumbs",
              breadcrumbs: "Breadcrumbs",
              loading: "Loading",
            });
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(
          RouterModule.forRoot([{ path: "**", component: EmptyComponent }], { useHash: true }),
        ),
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-26962&t=b5tDKylm5sWm2yKo-4",
    },
  },
  args: {
    size: "base",
  },
  argTypes: {
    breadcrumbs: {
      table: { disable: true },
    },
    click: { action: "clicked" },
    size: {
      table: { defaultValue: { summary: "base" } },
      control: { type: "radio", options: ["small", "base"] },
    },
  },
} as Meta;

type Story = StoryObj<BreadcrumbsComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-breadcrumbs [size]="size">
        <bit-breadcrumb icon="bwi-vault" route="/vault">Vault</bit-breadcrumb>
        <bit-breadcrumb route="/acme-corp">ACME Corp</bit-breadcrumb>
        <bit-breadcrumb route="/groups">Groups</bit-breadcrumb>
        <bit-breadcrumb>Members</bit-breadcrumb>
      </bit-breadcrumbs>
    `,
  }),
};

export const Sizes: Story = {
  render: (args) => ({
    props: args,
    template: `
      <h3 class="tw-text-main">Base (default)</h3>
      <p>
        <bit-breadcrumbs>
          <bit-breadcrumb icon="bwi-vault" route="/vault">Vault</bit-breadcrumb>
          <bit-breadcrumb route="/acme-corp">ACME Corp</bit-breadcrumb>
          <bit-breadcrumb route="/groups">Groups</bit-breadcrumb>
          <bit-breadcrumb>Members</bit-breadcrumb>
        </bit-breadcrumbs>
      </p>

      <h3 class="tw-text-main">Small</h3>
      <p>
        <bit-breadcrumbs size="small">
          <bit-breadcrumb icon="bwi-vault" route="/vault">Vault</bit-breadcrumb>
          <bit-breadcrumb route="/acme-corp">ACME Corp</bit-breadcrumb>
          <bit-breadcrumb route="/groups">Groups</bit-breadcrumb>
          <bit-breadcrumb>Members</bit-breadcrumb>
        </bit-breadcrumbs>
      </p>
    `,
  }),
};

export const TopLevel: Story = {
  render: (args) => ({
    props: args,
    template: `
      <h3 class="tw-text-main">Router links</h3>
      <p>
        <bit-breadcrumbs>
          <bit-breadcrumb icon="bwi-star" route="/top-level">Top Level</bit-breadcrumb>
        </bit-breadcrumbs>
      </p>
  
      <h3 class="tw-text-main">Click emit</h3>
      <p>
        <bit-breadcrumbs>
          <bit-breadcrumb icon="bwi-star">Top Level</bit-breadcrumb>
        </bit-breadcrumbs>
      </p>
    `,
  }),
};

export const SecondLevel: Story = {
  render: (args) => ({
    props: args,
    template: `
      <h3 class="tw-text-main">Router links</h3>
      <p>
        <bit-breadcrumbs>
          <bit-breadcrumb icon="bwi-folder" route="/folder1">Folder 1</bit-breadcrumb>
          <bit-breadcrumb icon="bwi-folder" route="/folder2">Folder 2</bit-breadcrumb>
        </bit-breadcrumbs>
      </p>
  
      <h3 class="tw-text-main">Click emit</h3>
      <p>
        <bit-breadcrumbs>
          <bit-breadcrumb icon="bwi-folder">Folder 1</bit-breadcrumb>
          <bit-breadcrumb icon="bwi-folder">Folder 2</bit-breadcrumb>        
        </bit-breadcrumbs>
      </p>
    `,
  }),
};

export const Overflow: Story = {
  render: (args) => ({
    props: args,
    template: `
      <h3 class="tw-text-main">Click emit</h3>
      <p>
        <bit-breadcrumbs [show]="10">
          <bit-breadcrumb icon="bwi-collection-shared">First Collection</bit-breadcrumb>
          <bit-breadcrumb icon="bwi-collection-shared">Middle-Collection 1</bit-breadcrumb>
          <bit-breadcrumb icon="bwi-collection-shared">Middle-Collection 2</bit-breadcrumb>
          <bit-breadcrumb icon="bwi-collection-shared">Middle-Collection 3</bit-breadcrumb>
          <bit-breadcrumb icon="bwi-collection-shared">Middle-Collection 4</bit-breadcrumb>
          <bit-breadcrumb icon="bwi-collection-shared">Middle-Collection 5</bit-breadcrumb>
          <bit-breadcrumb icon="bwi-collection-shared">Active Collection</bit-breadcrumb>
        </bit-breadcrumbs>
      </p>
    `,
  }),
};
