import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { VaultItemCopyActionsComponent } from "@bitwarden/vault";

import { VaultPopupCopyButtonsService } from "../../../services/vault-popup-copy-buttons.service";

import { ItemCopyActionsComponent } from "./item-copy-actions.component";

describe("ItemCopyActionsComponent", () => {
  let fixture: ComponentFixture<ItemCopyActionsComponent>;
  let component: ItemCopyActionsComponent;
  let showQuickCopyActionsSubject: BehaviorSubject<boolean>;

  beforeEach(async () => {
    showQuickCopyActionsSubject = new BehaviorSubject(true);

    await TestBed.configureTestingModule({
      imports: [CommonModule, ItemCopyActionsComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => key,
          } satisfies Partial<I18nService>,
        },
        {
          provide: VaultPopupCopyButtonsService,
          useValue: {
            showQuickCopyActions$: showQuickCopyActionsSubject.asObservable(),
          } satisfies Partial<VaultPopupCopyButtonsService>,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemCopyActionsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("cipher", {
      name: "My cipher",
    } as CipherViewLike);
  });

  function getSharedComponent(): VaultItemCopyActionsComponent {
    fixture.detectChanges();

    return fixture.debugElement.query(By.directive(VaultItemCopyActionsComponent))
      .componentInstance;
  }

  it("renders the shared vault item copy actions component", () => {
    expect(getSharedComponent()).toBeTruthy();
  });

  it("passes the cipher input through to the shared component", () => {
    const sharedComponent = getSharedComponent();

    expect(sharedComponent.cipher()).toBe(component.cipher());
  });

  it("passes quick copy mode through when enabled by the popup service", () => {
    const sharedComponent = getSharedComponent();

    expect(sharedComponent.showQuickCopyActions()).toBe(true);
  });

  it("passes quick copy mode through when disabled by the popup service", () => {
    showQuickCopyActionsSubject.next(false);

    const sharedComponent = getSharedComponent();

    expect(sharedComponent.showQuickCopyActions()).toBe(false);
  });
});
