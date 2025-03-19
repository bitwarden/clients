import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { PopupRouterCacheService } from "../../../../../platform/popup/view-cache/popup-router-cache.service";

import { PasswordHistoryV2Component } from "./vault-password-history-v2.component";

describe("PasswordHistoryV2Component", () => {
  let fixture: ComponentFixture<PasswordHistoryV2Component>;
  const params$ = new Subject();
  const mockUserId = "acct-1" as UserId;

  const mockCipherView = {
    id: "111-222-333",
    name: "cipher one",
  } as CipherView;

  const mockCipher = {
    decrypt: jest.fn().mockResolvedValue(mockCipherView),
  } as unknown as Cipher;

  const back = jest.fn().mockResolvedValue(undefined);
  const getCipher = jest.fn().mockResolvedValue(mockCipher);

  beforeEach(async () => {
    back.mockClear();
    getCipher.mockClear();

    await TestBed.configureTestingModule({
      imports: [PasswordHistoryV2Component],
      providers: [
        { provide: WINDOW, useValue: window },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: CipherService, useValue: mock<CipherService>({ get: getCipher }) },
        {
          provide: AccountService,
          useValue: mockAccountServiceWith(mockUserId),
        },
        { provide: PopupRouterCacheService, useValue: { back } },
        { provide: ActivatedRoute, useValue: { queryParams: params$ } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordHistoryV2Component);
    fixture.detectChanges();
  });

  it("loads the cipher from params the cipherId from the params", fakeAsync(() => {
    params$.next({ cipherId: mockCipherView.id });

    tick(100);

    expect(getCipher).toHaveBeenCalledWith(mockCipherView.id, mockUserId);
  }));

  it("navigates back when a cipherId is not in the params", () => {
    params$.next({});

    expect(back).toHaveBeenCalledTimes(1);
    expect(getCipher).not.toHaveBeenCalled();
  });
});
