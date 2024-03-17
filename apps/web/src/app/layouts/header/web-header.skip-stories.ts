// import { CommonModule } from "@angular/common";
// import { Component, importProvidersFrom, Injectable, Input } from "@angular/core";
// import { RouterModule } from "@angular/router";
// import {
//   applicationConfig,
//   componentWrapperDecorator,
//   Meta,
//   moduleMetadata,
//   Story,
// } from "@storybook/angular";
// import { BehaviorSubject, combineLatest, map, of } from "rxjs";

// import { JslibModule } from "@bitwarden/angular/jslib.module";
// import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
// import { VaultTimeoutAction } from "@bitwarden/common/enums/vault-timeout-action.enum";
// import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
// import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
// import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
// import {
//   AvatarModule,
//   BreadcrumbsModule,
//   ButtonModule,
//   IconButtonModule,
//   IconModule,
//   InputModule,
//   MenuModule,
//   NavigationModule,
//   TabsModule,
//   TypographyModule,
// } from "@bitwarden/components";

// import { DynamicAvatarComponent } from "../../components/dynamic-avatar.component";
// import { PreloadedEnglishI18nModule } from "../../core/tests";
// import { WebHeaderComponent } from "../header/web-header.component";

// import { WebLayoutMigrationBannerService } from "./web-layout-migration-banner.service";

// @Injectable({
//   providedIn: "root",
// })
// class MockStateService {
//   activeAccount$ = new BehaviorSubject("1").asObservable();
//   accounts$ = new BehaviorSubject({ "1": { profile: { name: "Foo" } } }).asObservable();
// }

// class MockMessagingService implements MessagingService {
//   send(subscriber: string, arg?: any) {
//     alert(subscriber);
//   }
// }

// class MockVaultTimeoutService {
//   availableVaultTimeoutActions$() {
//     return new BehaviorSubject([VaultTimeoutAction.Lock]).asObservable();
//   }
// }

// class MockPlatformUtilsService {
//   isSelfHost() {
//     return false;
//   }
// }

// @Component({
//   selector: "product-switcher",
//   template: `<button bitIconButton="bwi-filter"></button>`,
// })
// class MockProductSwitcher {}

// @Component({
//   selector: "dynamic-avatar",
//   template: `<bit-avatar [text]="name$ | async"></bit-avatar>`,
//   standalone: true,
//   imports: [CommonModule, AvatarModule],
// })
// class MockDynamicAvatar implements Partial<DynamicAvatarComponent> {
//   protected name$ = combineLatest([
//     this.stateService.accounts$,
//     this.stateService.activeAccount$,
//   ]).pipe(
//     map(
//       ([accounts, activeAccount]) => accounts[activeAccount as keyof typeof accounts].profile.name,
//     ),
//   );

//   @Input()
//   text: string;

//   constructor(private stateService: MockStateService) {}
// }

// export default {
//   title: "Web/Header",
//   component: WebHeaderComponent,
//   decorators: [
//     componentWrapperDecorator(
//       (story) => `<div class="tw-min-h-screen tw-flex-1 tw-p-6 tw-text-main">${story}</div>`,
//     ),
//     moduleMetadata({
//       imports: [
//         JslibModule,
//         AvatarModule,
//         BreadcrumbsModule,
//         ButtonModule,
//         IconButtonModule,
//         IconModule,
//         InputModule,
//         MenuModule,
//         TabsModule,
//         TypographyModule,
//         NavigationModule,
//         MockDynamicAvatar,
//       ],
//       declarations: [WebHeaderComponent, MockProductSwitcher],
//       providers: [
//         { provide: StateService, useClass: MockStateService },
//         {
//           provide: WebLayoutMigrationBannerService,
//           useValue: {
//             showBanner$: of(false),
//           } as Partial<WebLayoutMigrationBannerService>,
//         },
//         { provide: PlatformUtilsService, useClass: MockPlatformUtilsService },
//         { provide: VaultTimeoutSettingsService, useClass: MockVaultTimeoutService },
//         {
//           provide: MessagingService,
//           useFactory: () => {
//             return new MockMessagingService();
//           },
//         },
//       ],
//     }),
//     applicationConfig({
//       providers: [
//         importProvidersFrom(RouterModule.forRoot([], { useHash: true })),
//         importProvidersFrom(PreloadedEnglishI18nModule),
//       ],
//     }),
//   ],
// } as Meta;

// export const KitchenSink: Story = (args) => ({
//   props: args,
//   template: `
//     <app-header title="LongTitleeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" icon="bwi-bug">
//       <bit-breadcrumbs slot="breadcrumbs">
//         <bit-breadcrumb>Foo</bit-breadcrumb>
//         <bit-breadcrumb>Bar</bit-breadcrumb>
//       </bit-breadcrumbs>
//       <input
//         bitInput
//         placeholder="Ask Jeeves"
//         type="text"
//       />
//       <button bitButton buttonType="primary">New</button>
//       <button bitButton slot="secondary">Click Me 🎉</button>
//       <bit-tab-nav-bar slot="tabs">
//         <bit-tab-link route="">Foo</bit-tab-link>
//         <bit-tab-link route="#bar">Bar</bit-tab-link>
//       </bit-tab-nav-bar>
//     </app-header>
//   `,
// });

// export const Basic: Story = (args) => ({
//   props: args,
//   template: `
//     <app-header title="Foobar" icon="bwi-bug"></app-header>
//   `,
// });

// export const WithLongTitle: Story = (args) => ({
//   props: args,
//   template: `
//     <app-header title="LongTitleeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" icon="bwi-bug"></app-header>
//   `,
// });

// export const WithBreadcrumbs: Story = (args) => ({
//   props: args,
//   template: `
//     <app-header title="Foobar" icon="bwi-bug" class="tw-text-main">
//       <bit-breadcrumbs slot="breadcrumbs">
//         <bit-breadcrumb>Foo</bit-breadcrumb>
//         <bit-breadcrumb>Bar</bit-breadcrumb>
//       </bit-breadcrumbs>
//     </app-header>
//   `,
// });

// export const WithSearch: Story = (args) => ({
//   props: args,
//   template: `
//     <app-header title="Foobar" icon="bwi-bug" class="tw-text-main">
//       <input
//         bitInput
//         placeholder="Ask Jeeves"
//         type="text"
//       />
//     </app-header>
//   `,
// });

// export const WithSecondaryContent: Story = (args) => ({
//   props: args,
//   template: `
//     <app-header title="Foobar" icon="bwi-bug" class="tw-text-main">
//       <button bitButton slot="secondary">Click Me 🎉</button>
//     </app-header>
//   `,
// });

// export const WithTabs: Story = (args) => ({
//   props: args,
//   template: `
//     <app-header title="Foobar" icon="bwi-bug" class="tw-text-main">
//       <bit-tab-nav-bar slot="tabs">
//         <bit-tab-link route="">Foo</bit-tab-link>
//         <bit-tab-link route="#bar">Bar</bit-tab-link>
//       </bit-tab-nav-bar>
//     </app-header>
//   `,
// });

// export const WithTitleSuffixComponent: Story = (args) => ({
//   props: args,
//   template: `
//     <app-header title="Foobar" icon="bwi-bug" class="tw-text-main">
//       <ng-container slot="title-suffix"><i class="bwi bwi-spinner bwi-spin"></i></ng-container>
//     </app-header>
//   `,
// });
