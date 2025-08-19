import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of, BehaviorSubject } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { ButtonModule, NoItemsModule } from "@bitwarden/components";
import {
  NewSendDropdownComponent,
  SendListItemsContainerComponent,
  SendItemsService,
  SendSearchComponent,
  SendListFiltersComponent,
  SendListFiltersService,
} from "@bitwarden/send-ui";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { PopupRouterCacheService } from "../../../platform/popup/view-cache/popup-router-cache.service";

import { SendV2Component, SendState } from "./send-v2.component";

describe("SendV2Component", () => {
  let component: SendV2Component;
  let fixture: ComponentFixture<SendV2Component>;
  let sendItemsService: MockProxy<SendItemsService>;
  let sendListFiltersService: SendListFiltersService;
  let sendListFiltersServiceFilters$: BehaviorSubject<{ sendType: SendType | null }>;
  let sendItemsServiceEmptyList$: BehaviorSubject<boolean>;
  let sendItemsServiceNoFilteredResults$: BehaviorSubject<boolean>;
  let policyService: MockProxy<PolicyService>;

  beforeEach(async () => {
    sendListFiltersServiceFilters$ = new BehaviorSubject({ sendType: null });
    sendItemsServiceEmptyList$ = new BehaviorSubject(false);
    sendItemsServiceNoFilteredResults$ = new BehaviorSubject(false);

    sendItemsService = mock<SendItemsService>({
      filteredAndSortedSends$: of([
        { id: "1", name: "Send A" },
        { id: "2", name: "Send B" },
      ] as SendView[]),
      loading$: of(false),
      latestSearchText$: of(""),
    });

    policyService = mock<PolicyService>();
    policyService.policyAppliesToUser$.mockReturnValue(of(true)); // Return `true` by default

    sendListFiltersService = new SendListFiltersService(mock(), new FormBuilder());

    sendListFiltersService.filters$ = sendListFiltersServiceFilters$;
    sendItemsService.emptyList$ = sendItemsServiceEmptyList$;
    sendItemsService.noFilteredResults$ = sendItemsServiceNoFilteredResults$;

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        RouterTestingModule,
        JslibModule,
        ReactiveFormsModule,
        ButtonModule,
        NoItemsModule,
        NewSendDropdownComponent,
        SendListItemsContainerComponent,
        SendListFiltersComponent,
        SendSearchComponent,
        SendV2Component,
        PopupPageComponent,
        PopupHeaderComponent,
        PopOutComponent,
        CurrentAccountComponent,
      ],
      providers: [
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              id: "123",
              email: "test@email.com",
              emailVerified: true,
              name: "Test User",
            }),
          },
        },
        { provide: AuthService, useValue: mock<AuthService>() },
        { provide: AvatarService, useValue: mock<AvatarService>() },
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$: of(false) },
        },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: EnvironmentService, useValue: mock<EnvironmentService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: SendApiService, useValue: mock<SendApiService>() },
        { provide: SendItemsService, useValue: mock<SendItemsService>() },
        { provide: SearchService, useValue: mock<SearchService>() },
        { provide: SendService, useValue: { sendViews$: new BehaviorSubject<SendView[]>([]) } },
        { provide: SendItemsService, useValue: sendItemsService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: SendListFiltersService, useValue: sendListFiltersService },
        { provide: PopupRouterCacheService, useValue: mock<PopupRouterCacheService>() },
        { provide: PolicyService, useValue: policyService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should update the title based on the current filter", () => {
    sendListFiltersServiceFilters$.next({ sendType: SendType.File });
    fixture.detectChanges();
    expect(component["title"]).toBe("fileSends");
  });

  it("should set listState to Empty when emptyList$ emits true", () => {
    sendItemsServiceEmptyList$.next(true);
    fixture.detectChanges();
    expect(component["listState"]).toBe(SendState.Empty);
  });

  it("should set listState to NoResults when noFilteredResults$ emits true", () => {
    sendItemsServiceNoFilteredResults$.next(true);
    fixture.detectChanges();
    expect(component["listState"]).toBe(SendState.NoResults);
  });
});
