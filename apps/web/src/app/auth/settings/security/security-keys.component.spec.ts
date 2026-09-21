import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";

import { ChangeKdfModule } from "../../../key-management/change-kdf/change-kdf.module";
import { KeyRotationComponent } from "../../../key-management/key-rotation/key-rotation.component";
import { SecurityKeysComponentService } from "../../../key-management/services/security-keys-component.service";

import { SecurityKeysComponent } from "./security-keys.component";

@Component({
  selector: "app-user-key-rotation",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockKeyRotationComponent {}

@Component({
  selector: "app-change-kdf",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockChangeKdfComponent {}

describe("SecurityKeysComponent", () => {
  let fixture: ComponentFixture<SecurityKeysComponent>;

  let showChangeKdf: BehaviorSubject<boolean>;
  let showKeyRotation: BehaviorSubject<boolean>;

  const mockUserId = newGuid() as UserId;

  beforeEach(async () => {
    showChangeKdf = new BehaviorSubject<boolean>(false);
    showKeyRotation = new BehaviorSubject<boolean>(false);

    const securityKeysComponentService = {
      showChangeKdf$: showChangeKdf.asObservable(),
      showKeyRotation$: showKeyRotation.asObservable(),
    } as unknown as SecurityKeysComponentService;

    await TestBed.configureTestingModule({
      imports: [SecurityKeysComponent],
      providers: [
        { provide: AccountService, useValue: mockAccountServiceWith(mockUserId) },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    })
      .overrideComponent(SecurityKeysComponent, {
        remove: {
          imports: [ChangeKdfModule, KeyRotationComponent],
          providers: [SecurityKeysComponentService],
        },
        add: {
          imports: [MockChangeKdfComponent, MockKeyRotationComponent],
          providers: [
            { provide: SecurityKeysComponentService, useValue: securityKeysComponentService },
          ],
        },
      })
      .compileComponents();
  });

  async function renderComponent() {
    fixture = TestBed.createComponent(SecurityKeysComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function changeKdfElement() {
    return fixture.debugElement.query(By.directive(MockChangeKdfComponent));
  }

  function keyRotationElement() {
    return fixture.debugElement.query(By.directive(MockKeyRotationComponent));
  }

  describe("KDF settings", () => {
    it("shows the KDF settings when the component service shows them", async () => {
      showChangeKdf.next(true);

      await renderComponent();

      expect(changeKdfElement()).not.toBeNull();
    });

    it("hides the KDF settings when the component service hides them", async () => {
      showChangeKdf.next(false);

      await renderComponent();

      expect(changeKdfElement()).toBeNull();
    });
  });

  describe("key rotation", () => {
    it("shows key rotation when the component service shows it", async () => {
      showKeyRotation.next(true);

      await renderComponent();

      expect(keyRotationElement()).not.toBeNull();
    });

    it("hides key rotation when the component service hides it", async () => {
      showKeyRotation.next(false);

      await renderComponent();

      expect(keyRotationElement()).toBeNull();
    });
  });
});
