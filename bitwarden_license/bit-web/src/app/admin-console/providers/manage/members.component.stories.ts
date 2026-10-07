import { ScrollingModule } from "@angular/cdk/scrolling";
import { ChangeDetectionStrategy, Component, importProvidersFrom, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { NEVER, of } from "rxjs";
import { action } from "storybook/actions";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderUserStatusType, ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { ProviderUserUserDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  BerryComponent,
  DialogService,
  IconModule,
  LayoutComponent,
  ScrollLayoutDirective,
  SearchModule,
  StorybookGlobalStateProvider,
  ToastService,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { GlobalStateProvider } from "@bitwarden/state";
import { MemberActionsService } from "@bitwarden/web-vault/app/admin-console/organizations/members/services/member-actions/member-actions.service";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { MembersComponent } from "./members.component";
import { ProviderActionsService } from "./services/provider-actions/provider-actions.service";

@Component({
  selector: "app-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-mb-4">
    <ng-content></ng-content>
  </div>`,
})
class StubHeaderComponent {}

const PROVIDER_ID = "provider-story-1";
const USER_ID = "user-story-1" as UserId;

function providerUser(
  overrides: Partial<ProviderUserUserDetailsResponse> = {},
): ProviderUserUserDetailsResponse {
  return {
    id: "provider-user-1",
    userId: "user-1",
    type: ProviderUserType.ProviderAdmin,
    status: ProviderUserStatusType.Confirmed,
    permissions: undefined,
    name: "Ada Lovelace",
    email: "ada@example.com",
    ...overrides,
  } as ProviderUserUserDetailsResponse;
}

export default {
  title: "Admin Console/Providers/Manage/Members",
  component: MembersComponent,
  decorators: [
    componentWrapperDecorator(
      (story) => `<bit-layout style="height: 800px" class="tw-p-6">${story}</bit-layout>`,
    ),
    moduleMetadata({
      declarations: [MembersComponent],
      imports: [
        StubHeaderComponent,
        SharedModule,
        JslibModule,
        SearchModule,
        IconModule,
        BerryComponent,
        ScrollLayoutDirective,
        ScrollingModule,
        LayoutComponent,
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ providerId: PROVIDER_ID }),
            queryParams: of({}),
            data: of({ titleId: "" }),
          },
        },
        { provide: UserNamePipe, useValue: { transform: (u: { name?: string }) => u?.name ?? "" } },
        { provide: LogService, useValue: { error: action("LogService.error") } },
        {
          provide: MemberActionsService,
          useValue: {
            isProcessing: signal(false),
            getPublicKeyForConfirm: action("MemberActionsService.getPublicKeyForConfirm"),
          },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({ id: USER_ID, email: "user@example.com", emailVerified: true }),
          },
        },
        {
          provide: ProviderService,
          useValue: {
            get$: () =>
              of(
                new Provider({
                  id: PROVIDER_ID,
                  name: "Acme Managed Services",
                  status: ProviderUserStatusType.Confirmed,
                  type: ProviderUserType.ProviderAdmin,
                  enabled: true,
                  userId: USER_ID,
                  useEvents: false,
                  providerStatus: undefined,
                  providerType: undefined,
                } as any),
              ),
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            environment$: of({ isCloud: () => false }),
          },
        },
        {
          provide: ApiService,
          useValue: {
            getProviderUsers: async () => ({
              data: [
                providerUser(),
                providerUser({
                  id: "provider-user-2",
                  userId: "user-2",
                  name: "Grace Hopper",
                  email: "grace@example.com",
                  type: ProviderUserType.ServiceUser,
                  status: ProviderUserStatusType.Invited,
                }),
              ],
            }),
          },
        },
        {
          provide: ProviderActionsService,
          useValue: {
            isProcessing: signal(false),
          },
        },
        {
          provide: DialogService,
          useValue: {
            open: (...args: unknown[]) => {
              action("DialogService.open")(...args);
              return { closed: NEVER };
            },
            openSimpleDialog: async () => true,
          },
        },
        {
          provide: ValidationService,
          useValue: { showError: action("ValidationService.showError") },
        },
        {
          provide: ToastService,
          useValue: { showToast: action("ToastService.showToast") },
        },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        { provide: GlobalStateProvider, useClass: StorybookGlobalStateProvider },
      ],
    }),
  ],
} satisfies Meta<MembersComponent>;

type Story = StoryObj<MembersComponent>;

export const Default: Story = {};
