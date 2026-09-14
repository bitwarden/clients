import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogRef } from "@bitwarden/components";

import { ShareLinkService } from "../../services/share-link.service";

import { ShareButtonComponent } from "./share-button.component";

describe("ShareButtonComponent", () => {
  let fixture: ComponentFixture<ShareButtonComponent>;
  let canBeShared: BehaviorSubject<boolean>;
  let shareLinkService: MockProxy<ShareLinkService>;

  const button = (fixture: ComponentFixture<ShareButtonComponent>) =>
    fixture.debugElement.query(By.css("button"));

  beforeEach(async () => {
    shareLinkService = mock<ShareLinkService>();
    canBeShared = new BehaviorSubject(true);
    shareLinkService.cipherCanBeShared$.mockReturnValue(canBeShared.asObservable());

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    await TestBed.configureTestingModule({
      imports: [ShareButtonComponent],
      providers: [
        { provide: ShareLinkService, useValue: shareLinkService },
        { provide: I18nService, useValue: i18nService },
        { provide: DialogRef, useValue: null },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareButtonComponent);
    fixture.componentRef.setInput(
      "cipher",
      Object.assign(new CipherView(), { id: "cipher-id", name: "item" }),
    );
    fixture.detectChanges();
  });

  it("renders a button for an item that can be shared", async () => {
    expect(button(fixture)).not.toBeNull();
    expect(button(fixture).nativeElement.textContent.trim()).toBe("shareVerb");
  });

  it("renders nothing for an item that cannot be shared, so hosts need no condition", async () => {
    canBeShared.next(false);
    fixture.detectChanges();

    expect(button(fixture)).toBeNull();
  });

  it("starts the share flow when activated", async () => {
    button(fixture).nativeElement.click();
    await fixture.whenStable();

    expect(shareLinkService.openShareForm).toHaveBeenCalledWith(
      fixture.componentInstance.cipher(),
      null,
    );
  });
});
