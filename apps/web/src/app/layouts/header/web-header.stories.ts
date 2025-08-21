import { CommonModule } from "@angular/common";
import { Component, importProvidersFrom, Injectable, Input } from "@angular/core";
import { RouterModule } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { BehaviorSubject, combineLatest, map, of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
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

import { DynamicAvatarComponent } from "../../components/dynamic-avatar.component";
import { PreloadedEnglishI18nModule } from "../../core/tests";
import { WebHeaderComponent } from "../header/web-header.component";

import { WebLayoutMigrationBannerService } from "./web-layout-migration-banner.service";

@Injectable({
  providedIn: "root",
})
class MockStateService {
  activeAccount$ = new BehaviorSubject("1").asObservable();
  accounts$ = new BehaviorSubject({ "1": { profile: { name: "Foo" } } }).asObservable();
}

@Component({
  selector: "product-switcher",
  template: `<button type="button" bitIconButton="bwi-filter" label="Switch products"></button>`,
  standalone: false,
})
class MockProductSwitcher {}

@Component({
  selector: "dynamic-avatar",
  template: `<bit-avatar [text]="name$ | async"></bit-avatar>`,
  imports: [CommonModule, AvatarModule],
})
class MockDynamicAvatar implements Partial<DynamicAvatarComponent> {
  protected name$ = combineLatest([
    this.stateService.accounts$,
    this.stateService.activeAccount$,
  ]).pipe(
    map(
      ([accounts, activeAccount]) => accounts[activeAccount as keyof typeof accounts].profile.name,
    ),
  );

  @Input()
  text?: string;

  constructor(private stateService: MockStateService) {}
}

export default {
  title: "Web/Header",
  component: WebHeaderComponent,
  decorators: [
    componentWrapperDecorator(
      (story) => `<div class="tw-min-h-screen tw-flex-1 tw-p-6 tw-text-main">${story}</div>`,
    ),
    moduleMetadata({
      imports: [
        JslibModule,
        AvatarModule,
        BreadcrumbsModule,
        ButtonModule,
        IconButtonModule,
        IconModule,
        InputModule,
        MenuModule,
        TabsModule,
        TypographyModule,
        NavigationModule,
        MockDynamicAvatar,
      ],
      declarations: [WebHeaderComponent, MockProductSwitcher],
      providers: [
        { provide: StateService, useClass: MockStateService },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              name: "Foobar Warden",
            }),
          } as Partial<AccountService>,
        },
        {
          provide: WebLayoutMigrationBannerService,
          useValue: {
            showBanner$: of(false),
          } as Partial<WebLayoutMigrationBannerService>,
        },
        {
          provide: PlatformUtilsService,
          useValue: {
            isSelfHost() {
              return false;
            },
          } as Partial<PlatformUtilsService>,
        },
        {
          provide: VaultTimeoutSettingsService,
          useValue: {
            availableVaultTimeoutActions$() {
              return new BehaviorSubject([VaultTimeoutAction.Lock]).asObservable();
            },
          } as Partial<VaultTimeoutSettingsService>,
        },
        {
          provide: MessagingService,
          useValue: {
            send: (...args: any[]) => {
              // eslint-disable-next-line no-console
              console.log("MessagingService.send", args);
            },
          } as Partial<MessagingService>,
        },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(RouterModule.forRoot([], { useHash: true })),
        importProvidersFrom(PreloadedEnglishI18nModule),
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<WebHeaderComponent>;

export const KitchenSink: Story = {
  render: (args) => ({
    props: args,
    template: `
          <app-header title="LongTitleeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" icon="bwi-bug">
            <bit-breadcrumbs slot="breadcrumbs">
              <bit-breadcrumb>Foo</bit-breadcrumb>
              <bit-breadcrumb>Bar</bit-breadcrumb>
            </bit-breadcrumbs>
            <input
              bitInput
              placeholder="Ask Jeeves"
              type="text"
            />
            <button bitButton buttonType="primary">New</button>
            <button bitButton slot="secondary">Click Me 🎉</button>
            <bit-tab-nav-bar slot="tabs">
              <bit-tab-link route="">Foo</bit-tab-link>
              <bit-tab-link route="#bar">Bar</bit-tab-link>
            </bit-tab-nav-bar>
          </app-header>
        `,
  }),
};

export const Basic: Story = {
  render: (args: any) => ({
    props: args,
    template: `
    <app-header title="Foobar" icon="bwi-bug"></app-header>
  `,
  }),
};

export const WithLongTitle: Story = {
  render: (arg: any) => ({
    props: arg,
    template: `
    <app-header title="LongTitleeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" icon="bwi-bug">
        <ng-container slot="title-suffix"><i class="bwi bwi-key"></i></ng-container>
    </app-header>
  `,
  }),
};

export const WithBreadcrumbs: Story = {
  render: (args: any) => ({
    props: args,
    template: `
    <app-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <bit-breadcrumbs slot="breadcrumbs">
        <bit-breadcrumb>Foo</bit-breadcrumb>
        <bit-breadcrumb>Bar</bit-breadcrumb>
      </bit-breadcrumbs>
    </app-header>
  `,
  }),
};

export const WithSearch: Story = {
  render: (args: any) => ({
    props: args,
    template: `
    <app-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <input
        bitInput
        placeholder="Ask Jeeves"
        type="text"
      />
    </app-header>
  `,
  }),
};

export const WithSecondaryContent: Story = {
  render: (args) => ({
    props: args,
    template: `
    <app-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <button bitButton slot="secondary">Click Me 🎉</button>
    </app-header>
  `,
  }),
};

export const WithTabs: Story = {
  render: (args) => ({
    props: args,
    template: `
    <app-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <bit-tab-nav-bar slot="tabs">
        <bit-tab-link route="">Foo</bit-tab-link>
        <bit-tab-link route="#bar">Bar</bit-tab-link>
      </bit-tab-nav-bar>
    </app-header>
  `,
  }),
};

export const WithTitleSuffixComponent: Story = {
  render: (args) => ({
    props: args,
    template: `
    <app-header title="Foobar" icon="bwi-bug" class="tw-text-main">
      <ng-container slot="title-suffix"><i class="bwi bwi-spinner bwi-spin"></i></ng-container>
    </app-header>
  `,
  }),
};
