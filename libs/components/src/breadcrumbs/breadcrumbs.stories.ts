import { Component, importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconButtonModule } from "../icon-button";
import { LinkModule } from "../link";
import { MenuModule } from "../menu";
import { I18nMockService } from "../utils";

import { BreadcrumbComponent } from "./breadcrumb.component";
import { BreadcrumbsComponent } from "./breadcrumbs.component";

interface Breadcrumb {
  icon?: string;
  name: string;
  route: string;
}

@Component({
  template: "",
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
    items: [],
    show: 3,
  },
  argTypes: {
    breadcrumbs: {
      table: { disable: true },
    },
    click: { action: "clicked" },
  },
} as Meta;

type Story = StoryObj<BreadcrumbsComponent & { items: Breadcrumb[] }>;

export const TopLevel: Story = {
  render: (args) => ({
    props: args,
    template: `
      <h3 class="tw-text-main">Router links</h3>
      <p>
        <bit-breadcrumbs [show]="show">
          <bit-breadcrumb *ngFor="let item of items" [icon]="item.icon" [route]="[item.route]">{{item.name}}</bit-breadcrumb>
        </bit-breadcrumbs>
      </p>
  
      <h3 class="tw-text-main">Click emit</h3>
      <p>
        <bit-breadcrumbs [show]="show">
          <bit-breadcrumb *ngFor="let item of items" [icon]="item.icon" (click)="click($event)">{{item.name}}</bit-breadcrumb>
        </bit-breadcrumbs>
      </p>
    `,
  }),

  args: {
    items: [{ icon: "bwi-star", name: "Top Level" }] as Breadcrumb[],
  },
};

export const SecondLevel: Story = {
  ...TopLevel,
  args: {
    items: [
      { name: "Acme Vault", route: "/" },
      { icon: "bwi-collection-shared", name: "Collection", route: "collection" },
    ] as Breadcrumb[],
  },
};

export const Overflow: Story = {
  ...TopLevel,
  args: {
    items: [
      { name: "Acme Vault", route: "" },
      { icon: "bwi-collection-shared", name: "Collection", route: "collection" },
      { icon: "bwi-collection-shared", name: "Middle-Collection 1", route: "middle-collection-1" },
      { icon: "bwi-collection-shared", name: "Middle-Collection 2", route: "middle-collection-2" },
      { icon: "bwi-collection-shared", name: "Middle-Collection 3", route: "middle-collection-3" },
      { icon: "bwi-collection-shared", name: "Middle-Collection 4", route: "middle-collection-4" },
      { icon: "bwi-collection-shared", name: "End Collection", route: "end-collection" },
    ] as Breadcrumb[],
  },
};
