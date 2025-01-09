import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { ToastService } from "@bitwarden/components";
import {
  PasswordGenerationServiceAbstraction,
  UsernameGenerationServiceAbstraction,
} from "@bitwarden/generator-legacy";

import { GeneratorComponent } from "./generator.component";

describe("GeneratorComponent", () => {
  let component: GeneratorComponent;
  let fixture: ComponentFixture<GeneratorComponent>;
  let platformUtilsServiceMock: MockProxy<PlatformUtilsService>;

  beforeEach(() => {
    platformUtilsServiceMock = mock<PlatformUtilsService>();

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    TestBed.configureTestingModule({
      declarations: [GeneratorComponent, I18nPipe],
      providers: [
        {
          provide: PasswordGenerationServiceAbstraction,
          useValue: mock<PasswordGenerationServiceAbstraction>(),
        },
        {
          provide: UsernameGenerationServiceAbstraction,
          useValue: mock<UsernameGenerationServiceAbstraction>(),
        },
        {
          provide: PlatformUtilsService,
          useValue: platformUtilsServiceMock,
        },
        {
          provide: I18nService,
          useValue: mock<I18nService>(),
        },
        {
          provide: ActivatedRoute,
          useValue: mock<ActivatedRoute>(),
        },
        {
          provide: LogService,
          useValue: mock<LogService>(),
        },
        {
          provide: CipherService,
          useValue: mock<CipherService>(),
        },
        {
          provide: AccountService,
          useValue: mock<AccountService>(),
        },
        {
          provide: ToastService,
          useValue: mock<ToastService>(),
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("usernameTypesLearnMore()", () => {
    it("should call platformUtilsService.launchUri() once", () => {
      component.usernameTypesLearnMore();
      expect(platformUtilsServiceMock.launchUri).toHaveBeenCalledTimes(1);
    });
  });
});
