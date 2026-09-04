import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { enabledFlags } from "@bitwarden/storybook";

import {
  AvatarModule,
  BreadcrumbsModule,
  ButtonModule,
  IconButtonModule,
  SvgModule,
  InputModule,
  MenuModule,
  NavigationModule,
  TabsModule,
  TypographyModule,
  IconComponent,
} from "..";
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
        IconComponent,
        SvgModule,
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
              breadcrumbs: "Breadcrumbs",
              loading: "Loading",
              more: "More",
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
        <button slot="title-suffix" buttonType="subtleGhost" bitIconButton="bwi-info-circle" label="A thing"></button>
        <input
          bitInput
          placeholder="Ask Jeeves"
          type="text"
        />
        <button type="button" bitIconButton="bwi-grid" label="Switch products"></button>
        <bit-avatar text="Will" size="lg"></bit-avatar>
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

export const KitchenSinkVfo1: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-header title="LongTitleeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" icon="bwi-bug">
        <bit-breadcrumbs slot="breadcrumbs">
          <bit-breadcrumb>Foo</bit-breadcrumb>
          <bit-breadcrumb>Bar</bit-breadcrumb>
        </bit-breadcrumbs>
        <button slot="title-suffix" buttonType="subtleGhost" bitIconButton="bwi-info-circle" label="A thing"></button>
        <div slot="subtitle">Very informative subtitle since the title itself was not enough information to understand the page</div>
        <button bitButton>Click Me 🎉</button>
        <button bitButton buttonType="primary">New</button>
        <bit-tab-nav-bar slot="tabs">
          <bit-tab-link [route]="['foo']">Foo</bit-tab-link>
          <bit-tab-link [route]="['bar']">Bar</bit-tab-link>
        </bit-tab-nav-bar>
      </bit-header>
    `,
  }),
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
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

export const TitleWithSubtitleVfo1: Story = {
  render: (arg: any) => ({
    props: arg,
    template: /*html*/ `
    <bit-header title="LongTitleeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" icon="bwi-bug">
      <ng-container slot="title-suffix"><i class="bwi bwi-key"></i></ng-container>
      <div slot="subtitle">Very informative subtitle since the title itself was not enough information to understand the page</div>
    </bit-header>
  `,
  }),
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};

export const BreadcrumbsWithSubtitleVfo1: Story = {
  render: (arg: any) => ({
    props: arg,
    template: /*html*/ `
    <bit-header title="Fallback Title" icon="bwi-bug">
        <bit-breadcrumbs slot="breadcrumbs">
        <bit-breadcrumb route="/bar">Bar</bit-breadcrumb>
        <bit-breadcrumb route="/foo">Foo</bit-breadcrumb>
      </bit-breadcrumbs>
      <div slot="subtitle">Very informative subtitle since the title itself was not enough information to understand the page</div>
    </bit-header>
  `,
  }),
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
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

export const WithBreadcrumbsVfo1: Story = {
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
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};

export const WithActiveBreadcrumb: Story = {
  render: (args: any) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <bit-breadcrumbs slot="breadcrumbs">
        <bit-breadcrumb route="/bar">Bar</bit-breadcrumb>
        <bit-breadcrumb route="/foo">Foo</bit-breadcrumb>
      </bit-breadcrumbs>
    </bit-header>
  `,
  }),
};

export const WithActiveBreadcrumbVfo1: Story = {
  render: (args: any) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <bit-breadcrumbs slot="breadcrumbs">
        <bit-breadcrumb route="/bar">Bar</bit-breadcrumb>
        <bit-breadcrumb route="/foo">Foo</bit-breadcrumb>
      </bit-breadcrumbs>
    </bit-header>
  `,
  }),
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
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

export const TitleWithPrimaryContent: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <button bitButton buttonType="primary">New</button>
    </bit-header>
  `,
  }),
};

export const TitleWithPrimaryContentVfo1: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <button bitButton buttonType="primary">New</button>
    </bit-header>
  `,
  }),
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
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

export const BreadcrumbsWithPrimaryContent: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <bit-breadcrumbs slot="breadcrumbs">
        <bit-breadcrumb route="/bar">Bar</bit-breadcrumb>
        <bit-breadcrumb route="/foo">Foo</bit-breadcrumb>
      </bit-breadcrumbs>
      <button bitButton buttonType="primary">New</button>
    </bit-header>
  `,
  }),
};

export const BreadcrumbsWithPrimaryContentVfo1: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <bit-breadcrumbs slot="breadcrumbs">
        <bit-breadcrumb route="/bar">Bar</bit-breadcrumb>
        <bit-breadcrumb route="/foo">Foo</bit-breadcrumb>
      </bit-breadcrumbs>
      <button bitButton buttonType="primary">New</button>
    </bit-header>
  `,
  }),
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
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

export const WithTabsVfo1: Story = {
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
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};

export const WithTitleSuffixComponent: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <ng-container slot="title-suffix"><bit-icon name="bwi-spinner" class="bwi-spin"></bit-icon></ng-container>
    </bit-header>
  `,
  }),
};
