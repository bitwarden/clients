import { ChangeDetectionStrategy, Component, importProvidersFrom, inject } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconButtonModule } from "../icon-button";
import { LinkModule } from "../link";
import { MenuModule } from "../menu";
import { I18nMockService } from "../utils";

import { BreadcrumbComponent } from "./breadcrumb.component";
import { BreadcrumbsComponent } from "./breadcrumbs.component";

import { formatArgsForCodeSnippet } from ".storybook/format-args-for-code-snippet";
@Component({
  template: /*html*/ ` <div class="tw-mt-5">Some really cool content for {{ currentUrl }}</div> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ContentComponent {
  readonly router = inject(Router);

  readonly currentUrl = this.router.url;
}

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
          RouterModule.forRoot(
            [
              {
                path: "",
                children: [
                  { path: "", redirectTo: "vault", pathMatch: "full" },
                  { path: "vault", component: ContentComponent },
                  { path: "acme-corp", component: ContentComponent },
                  { path: "groups", component: ContentComponent },
                  { path: "members", component: ContentComponent },
                  { path: "items", component: ContentComponent },
                  { path: "sends", component: ContentComponent },
                  { path: "settings", component: ContentComponent },
                ],
              },
            ],
            { useHash: true },
          ),
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
    showTrailingArrow: false,
    show: 4,
  },
  argTypes: {
    breadcrumbs: {
      table: { disable: true },
    },
    size: {
      table: { defaultValue: { summary: "base" } },
      control: { type: "radio", options: ["small", "base"] },
    },
    showTrailingArrow: {
      control: { type: "boolean" },
    },
    show: {
      control: { type: "number" },
    },
  },
} as Meta;

type Story = StoryObj<BreadcrumbsComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-breadcrumbs ${formatArgsForCodeSnippet<BreadcrumbsComponent>(args)}>
      <bit-breadcrumb icon="bwi-vault" route="/vault">Vault</bit-breadcrumb>
      <bit-breadcrumb route="/acme-corp">ACME Corp</bit-breadcrumb>
      <bit-breadcrumb route="/groups">Groups</bit-breadcrumb>
      <bit-breadcrumb route="/members">Members</bit-breadcrumb>
    </bit-breadcrumbs>
    <router-outlet />
    `,
  }),
};

export const Small: Story = {
  ...Default,
  args: {
    size: "small",
  },
};

export const DefaultAsButtons: Story = {
  render: (args) => ({
    props: {
      ...args,
      // eslint-disable-next-line
      clickHandler: () => console.log("clicked!"),
    },
    template: /*html*/ `
    <bit-breadcrumbs ${formatArgsForCodeSnippet<BreadcrumbsComponent>(args)}>
      <bit-breadcrumb icon="bwi-vault" (click)="clickHandler()">Vault</bit-breadcrumb>
      <bit-breadcrumb (click)="clickHandler()">ACME Corp</bit-breadcrumb>
      <bit-breadcrumb (click)="clickHandler()">Groups</bit-breadcrumb>
      <bit-breadcrumb (click)="clickHandler()">Members</bit-breadcrumb>
    </bit-breadcrumbs>
    `,
  }),
};

export const OverflowLinks: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-breadcrumbs ${formatArgsForCodeSnippet<BreadcrumbsComponent>(args)}>
        <bit-breadcrumb route="/vault">Vault</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-collection-shared" route="/acme-corp">ACME Corp</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-collection-shared" route="/groups">Groups</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-collection-shared" route="/members">Members</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-collection-shared" route="/items">Items</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-collection-shared" route="/sends">Sends</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-collection-shared" route="/settings">Settings</bit-breadcrumb>
      </bit-breadcrumbs>
      <router-outlet/>
    `,
  }),
};

export const OverflowButtons: Story = {
  render: (args) => ({
    props: {
      ...args,
      // eslint-disable-next-line
      clickHandler: () => console.log("clicked!"),
    },
    template: /*html*/ `
      <bit-breadcrumbs ${formatArgsForCodeSnippet<BreadcrumbsComponent>(args)}>
        <bit-breadcrumb (click)="clickHandler()">Vault</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-collection-shared" (click)="clickHandler()">ACME Corp</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-collection-shared" (click)="clickHandler()">Groups</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-collection-shared" (click)="clickHandler()">Members</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-collection-shared" (click)="clickHandler()">Items</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-collection-shared" (click)="clickHandler()">Sends</bit-breadcrumb>
        <bit-breadcrumb icon="bwi-collection-shared" (click)="clickHandler()">Settings</bit-breadcrumb>
      </bit-breadcrumbs>
    `,
  }),
};

export const WithTrailingArrow: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-breadcrumbs ${formatArgsForCodeSnippet<BreadcrumbsComponent>(args)}>
      <bit-breadcrumb icon="bwi-vault" route="/unknown-route">Breadcrumb</bit-breadcrumb>
      <bit-breadcrumb route="/unknown-route-2">Breadcrumb 2</bit-breadcrumb>
      <bit-breadcrumb route="/unknown-route-3">Breadcrumb 3</bit-breadcrumb>
      <bit-breadcrumb route="/unknown-route-4">Breadcrumb 4</bit-breadcrumb>
    </bit-breadcrumbs>
    `,
  }),
  args: {
    showTrailingArrow: true,
  },
};
