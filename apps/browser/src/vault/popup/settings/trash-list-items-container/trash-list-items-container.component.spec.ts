import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedCipherAction } from "@bitwarden/common/vault/utils/restricted-cipher-policy";
import { DialogService, ToastService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { PopupCipherViewLike } from "../../views/popup-cipher.view";

import { TrashListItemsContainerComponent } from "./trash-list-items-container.component";

describe("TrashListItemsContainerComponent", () => {
  let component: TrashListItemsContainerComponent;
  let fixture: ComponentFixture<TrashListItemsContainerComponent>;
  let revealed$: BehaviorSubject<ReadonlyMap<CipherId, CipherView>>;
  let activeAccount$: BehaviorSubject<{ id: string } | null>;

  const restrictedRow = () =>
    Object.assign(new CipherView(), {
      id: "restricted" as CipherId,
      partial: true,
      deletedDate: new Date(),
    }) as PopupCipherViewLike;

  beforeEach(async () => {
    revealed$ = new BehaviorSubject<ReadonlyMap<CipherId, CipherView>>(new Map());
    activeAccount$ = new BehaviorSubject<{ id: string } | null>({ id: "user-id" });
    const revealedCipherService = mock<RevealedCipherService>();
    revealedCipherService.revealed$.mockReturnValue(revealed$);

    await TestBed.configureTestingModule({
      imports: [TrashListItemsContainerComponent],
      providers: [
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: RevealedCipherService, useValue: revealedCipherService },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
        { provide: Router, useValue: { url: "/trash", navigate: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TrashListItemsContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("allows", () => {
    it("allows restore and delete for an unrestricted cipher", () => {
      const cipher = Object.assign(new CipherView(), {
        id: "regular" as CipherId,
        deletedDate: new Date(),
      }) as PopupCipherViewLike;

      expect(component.allows(cipher, RestrictedCipherAction.Restore)).toBe(true);
      expect(component.allows(cipher, RestrictedCipherAction.Delete)).toBe(true);
    });

    it("blocks restore and delete for a restricted cipher without a revealed view", () => {
      const cipher = restrictedRow();

      expect(component.allows(cipher, RestrictedCipherAction.Restore)).toBe(false);
      expect(component.allows(cipher, RestrictedCipherAction.Delete)).toBe(false);
    });

    it("allows restore and delete for a restricted cipher while it is revealed", () => {
      const cipher = restrictedRow();
      revealed$.next(
        new Map([["restricted" as CipherId, Object.assign(new CipherView(), { id: cipher.id })]]),
      );

      expect(component.allows(cipher, RestrictedCipherAction.Restore)).toBe(true);
      expect(component.allows(cipher, RestrictedCipherAction.Delete)).toBe(true);
    });

    it("blocks restore for a restricted cipher when there is no active account", () => {
      const cipher = restrictedRow();
      revealed$.next(
        new Map([["restricted" as CipherId, Object.assign(new CipherView(), { id: cipher.id })]]),
      );
      activeAccount$.next(null);

      expect(component.allows(cipher, RestrictedCipherAction.Restore)).toBe(false);
    });
  });
});
