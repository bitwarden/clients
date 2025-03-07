// import { Injectable } from "@angular/core";
// import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

// import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
// import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
// import { I18nMockService } from "@bitwarden/components/src/utils/i18n-mock.service";

// import { AccountComponent } from "./account.component";
// import { AccountSwitcherService } from "./services/account-switcher.service";

// @Injectable({
//   providedIn: "root",
// })
// class MockAccountSwitcherService {
//   SPECIAL_ADD_ACCOUNT_ID = "addAccount";

//   get specialAccountAddId() {
//     return this.SPECIAL_ADD_ACCOUNT_ID;
//   }

//   async selectAccount(id: string) {
//     return;
//   }
// }

// export default {
//   title: "Auth/Account",
//   component: AccountComponent,
//   decorators: [
//     moduleMetadata({
//       providers: [
//         { provide: AccountSwitcherService, useClass: MockAccountSwitcherService },
//         {
//           provide: I18nService,
//           useFactory: () => {
//             return new I18nMockService({
//               switchToAccount: "switchToAccount",
//               activeAccount: "activeAccount",
//               active: "active",
//               unlocked: "unlocked",
//               locked: "locked",
//             });
//           },
//         },
//       ],
//     }),
//   ],
// } as Meta;

// type Story = StoryObj<AccountComponent>;

// export const Unlocked: Story = {
//   render: (args) => ({
//     props: args,
//     template: `
//       <div class="tw-py-16 tw-px-8 -tw-my-10 -tw-mx-5 tw-bg-background-alt">
//         <auth-account [account]="account"></auth-account>
//       </div>
//     `,
//   }),
//   args: {
//     account: {
//       name: "John Doe",
//       id: "John Doe",
//       isActive: false,
//       status: AuthenticationStatus.Unlocked,
//     },
//   },
// };

// export const Locked: Story = {
//   ...Unlocked,
//   args: {
//     account: {
//       ...Unlocked.args.account,
//       status: AuthenticationStatus.Locked,
//     },
//   },
// };

// export const Active: Story = {
//   ...Unlocked,
//   args: {
//     account: {
//       ...Unlocked.args.account,
//       isActive: true,
//     },
//   },
// };

// export const AddAccount: Story = {
//   ...Unlocked,
//   args: {
//     account: {
//       name: "Add Account",
//       id: "addAccount",
//       isActive: false,
//     },
//   },
// };
