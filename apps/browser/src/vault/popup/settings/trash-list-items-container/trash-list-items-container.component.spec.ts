import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { PopupCipherViewLike } from "../../views/popup-cipher.view";

import { TrashListItemsContainerComponent } from "./trash-list-items-container.component";

describe("TrashListItemsContainerComponent", () => {
  let fixture: ComponentFixture<TrashListItemsContainerComponent>;
  const cipherAuthorizationService = mock<CipherAuthorizationService>();

  const trashedCipher = Object.assign(new CipherView(), {
    id: "trashed" as CipherId,
    name: "Trashed item",
    deletedDate: new Date(),
  }) as PopupCipherViewLike;

  beforeEach(async () => {
    cipherAuthorizationService.canDeleteCipher$.mockReturnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [TrashListItemsContainerComponent],
      providers: [
        { provide: CipherAuthorizationService, useValue: cipherAuthorizationService },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
        { provide: Router, useValue: { url: "/trash", navigate: jest.fn() } },
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: (): string => null }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(false) } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TrashListItemsContainerComponent);
    fixture.componentInstance.ciphers = [trashedCipher];
  });

  const moreOptionsButton = () => fixture.debugElement.query(By.css("button[bitIconButton]"));

  it("shows the row menu when the cipher can be restored", () => {
    cipherAuthorizationService.canRestoreCipher$.mockReturnValue(of(true));

    fixture.detectChanges();

    expect(cipherAuthorizationService.canRestoreCipher$).toHaveBeenCalledWith(trashedCipher);
    expect(moreOptionsButton()).not.toBeNull();
  });

  it("hides the row menu when the cipher cannot be restored", () => {
    cipherAuthorizationService.canRestoreCipher$.mockReturnValue(of(false));

    fixture.detectChanges();

    expect(moreOptionsButton()).toBeNull();
  });
});
