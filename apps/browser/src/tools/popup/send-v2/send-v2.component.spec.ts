import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterLink } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { Observable, of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { ButtonModule, NoItemsModule } from "@bitwarden/components";
import {
  NewSendDropdownComponent,
  SendListItemsContainerComponent,
  SendListFiltersComponent,
} from "@bitwarden/send-ui";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { SendV2Component } from "./send-v2.component";

describe("SendV2Component", () => {
  let component: SendV2Component;
  let fixture: ComponentFixture<SendV2Component>;
  let sendViews$: Observable<SendView[]>;

  beforeEach(async () => {
    sendViews$ = of([
      { id: "1", name: "Send A" },
      { id: "2", name: "Send B" },
    ] as SendView[]);

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        RouterTestingModule,
        JslibModule,
        NoItemsModule,
        ButtonModule,
        NoItemsModule,
        RouterLink,
        NewSendDropdownComponent,
        SendListItemsContainerComponent,
        SendListFiltersComponent,
        PopupPageComponent,
        PopupHeaderComponent,
        PopOutComponent,
        CurrentAccountComponent,
      ],
      providers: [
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: AuthService, useValue: mock<AuthService>() },
        { provide: AvatarService, useValue: mock<AvatarService>() },
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>(),
        },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: EnvironmentService, useValue: mock<EnvironmentService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: SendApiService, useValue: mock<SendApiService>() },
        { provide: SendService, useValue: { sendViews$ } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendV2Component);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should sort sends by name on initialization", async () => {
    const sortedSends = [
      { id: "1", name: "Send A" },
      { id: "2", name: "Send B" },
    ] as SendView[];

    await component.ngOnInit();

    expect(component.sends).toEqual(sortedSends);
  });
});
