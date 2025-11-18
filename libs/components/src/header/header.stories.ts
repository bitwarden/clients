import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AvatarModule,
  BreadcrumbsModule,
  ButtonModule,
  IconButtonModule,
  IconModule,
  InputModule,
  MenuModule,
  NavigationModule,
  TabsModule,
  TypographyModule,
} from "@bitwarden/components";

import { I18nMockService } from "../utils";

import { HeaderComponent } from "./header.component";

export default {
  title: "Component Library/Header",
  component: HeaderComponent,
  decorators: [
    componentWrapperDecorator(
      (story) => `<div class="tw-min-h-screen tw-flex-1 tw-p-6 tw-text-main">${story}</div>`,
    ),
    moduleMetadata({
      imports: [
        HeaderComponent,

        AvatarModule,
        BreadcrumbsModule,
        ButtonModule,
        IconButtonModule,
        IconModule,
        InputModule,
        MenuModule,
        NavigationModule,
        TabsModule,
        TypographyModule,
      ],
    }),
    applicationConfig({
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              moreBreadcrumbs: "More breadcrumbs",
              loading: "Loading",
            });
          },
        },
        importProvidersFrom(
          RouterModule.forRoot(
            [
              { path: "", redirectTo: "foo", pathMatch: "full" },
              { path: "foo", component: HeaderComponent },
              { path: "bar", component: HeaderComponent },
            ],
            { useHash: true },
          ),
        ),
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<HeaderComponent>;

export const KitchenSink: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
          <bit-header title="LongTitleeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" icon="bwi-bug">
            <bit-breadcrumbs slot="breadcrumbs">
              <bit-breadcrumb>Foo</bit-breadcrumb>
              <bit-breadcrumb>Bar</bit-breadcrumb>
            </bit-breadcrumbs>
            <input
              bitInput
              placeholder="Ask Jeeves"
              type="text"
            />
            <button type="button" bitIconButton="bwi-filter" label="Switch products"></button>
            <bit-avatar text="Will"></bit-avatar>
            <button bitButton buttonType="primary">New</button>
            <button bitButton slot="secondary">Click Me 🎉</button>
            <bit-tab-nav-bar slot="tabs">
              <bit-tab-link [route]="['foo']">Foo</bit-tab-link>
              <bit-tab-link [route]="['bar']">Bar</bit-tab-link>
            </bit-tab-nav-bar>
          </bit-header>
        `,
  }),
};

export const Basic: Story = {
  render: (args: any) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" />
  `,
  }),
};

export const WithLongTitle: Story = {
  render: (arg: any) => ({
    props: arg,
    template: /*html*/ `
    <bit-header title="LongTitleeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" icon="bwi-bug">
        <ng-container slot="title-suffix"><i class="bwi bwi-key"></i></ng-container>
    </bit-header>
  `,
  }),
};

export const WithBreadcrumbs: Story = {
  render: (args: any) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <bit-breadcrumbs slot="breadcrumbs">
        <bit-breadcrumb>Foo</bit-breadcrumb>
        <bit-breadcrumb>Bar</bit-breadcrumb>
      </bit-breadcrumbs>
    </bit-header>
  `,
  }),
};

export const WithSearch: Story = {
  render: (args: any) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <input
        bitInput
        placeholder="Ask Jeeves"
        type="text"
      />
    </bit-header>
  `,
  }),
};

export const WithSecondaryContent: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <button bitButton slot="secondary">Click Me 🎉</button>
    </bit-header>
  `,
  }),
};

export const WithTabs: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <bit-tab-nav-bar slot="tabs">
        <bit-tab-link [route]="['foo']">Foo</bit-tab-link>
        <bit-tab-link [route]="['bar']">Bar</bit-tab-link>
      </bit-tab-nav-bar>
    </bit-header>
  `,
  }),
};

export const WithTitleSuffixComponent: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <ng-container slot="title-suffix"><i class="bwi bwi-spinner bwi-spin"></i></ng-container>
    </bit-header>
  `,
  }),
};
