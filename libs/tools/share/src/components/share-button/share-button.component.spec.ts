import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogRef } from "@bitwarden/components";

import { ShareItemService } from "../../services/share-item.service";
import { ShareLinkService } from "../../services/share-link.service";

import { ShareButtonComponent } from "./share-button.component";

@Component({
  template: `<app-share-button [cipher]="cipher" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShareButtonComponent],
})
class HostComponent {
  cipher = Object.assign(new CipherView(), { id: "cipher-id", name: "item" });
}

describe("ShareButtonComponent", () => {
  let canBeShared: BehaviorSubject<boolean>;
  let shareItemService: MockProxy<ShareItemService>;
  let hostDialog: MockProxy<DialogRef> | null;

  const button = (fixture: ComponentFixture<HostComponent>) =>
    fixture.debugElement.query(By.css("button"));

  async function render(): Promise<ComponentFixture<HostComponent>> {
    const shareLinkService = mock<ShareLinkService>();
    shareLinkService.cipherCanBeShared$.mockReturnValue(canBeShared.asObservable());

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: ShareLinkService, useValue: shareLinkService },
        { provide: ShareItemService, useValue: shareItemService },
        { provide: I18nService, useValue: i18nService },
        { provide: DialogRef, useValue: hostDialog },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    canBeShared = new BehaviorSubject(true);
    shareItemService = mock<ShareItemService>();
    hostDialog = null;
  });

  it("renders a button for an item that can be shared", async () => {
    const fixture = await render();

    expect(button(fixture)).not.toBeNull();
    expect(button(fixture).nativeElement.textContent.trim()).toBe("shareVerb");
  });

  it("renders nothing for an item that cannot be shared, so hosts need no condition", async () => {
    const fixture = await render();

    canBeShared.next(false);
    fixture.detectChanges();

    expect(button(fixture)).toBeNull();
  });

  it("starts the share flow when activated", async () => {
    const fixture = await render();

    button(fixture).nativeElement.click();
    await fixture.whenStable();

    expect(shareItemService.share).toHaveBeenCalledWith(fixture.componentInstance.cipher, {
      alreadyVerified: false,
    });
  });

  describe("inside a dialog", () => {
    beforeEach(() => {
      hostDialog = mock<DialogRef>();
    });

    it("reports the user as already verified, since the dialog required re-prompt to open", async () => {
      const fixture = await render();

      button(fixture).nativeElement.click();
      await fixture.whenStable();

      expect(shareItemService.share).toHaveBeenCalledWith(fixture.componentInstance.cipher, {
        alreadyVerified: true,
      });
    });

    it("closes the dialog so the sharing surface is not covered", async () => {
      const fixture = await render();

      button(fixture).nativeElement.click();
      await fixture.whenStable();

      expect(hostDialog!.close).toHaveBeenCalled();
    });
  });
});
