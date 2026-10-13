import { ChangeDetectionStrategy, Component, Type } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { MenuComponent, MenuModule } from "@bitwarden/components";

import { ShareItemService } from "../../services/share-item.service";
import { ShareLinkService } from "../../services/share-link.service";

import { ShareLinkMenuItemDirective } from "./share-link-menu-item.directive";

class HostBase {
  cipher = Object.assign(new CipherView(), { id: "cipher-id", name: "item" });
}

/** Stands in for a menu item, without the menu, so the item renders into the DOM. */
@Component({
  template: `
    <button type="button" *appShareLinkMenuItem="cipher; let share = share" (click)="share()">
      share via link
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShareLinkMenuItemDirective],
})
class PlainHostComponent extends HostBase {}

/** The real shape: the item sits among a menu's other items. */
@Component({
  template: `
    <bit-menu>
      <button type="button" bitMenuItem>an unrelated item</button>
      <button
        type="button"
        bitMenuItem
        *appShareLinkMenuItem="cipher; let share = share"
        (click)="share()"
      >
        share via link
      </button>
    </bit-menu>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MenuModule, ShareLinkMenuItemDirective],
})
class MenuHostComponent extends HostBase {}

describe("ShareLinkMenuItemDirective", () => {
  let canBeShared: BehaviorSubject<boolean>;
  let shareItemService: MockProxy<ShareItemService>;

  async function render<T extends HostBase>(host: Type<T>): Promise<ComponentFixture<T>> {
    const shareLinkService = mock<ShareLinkService>();
    shareLinkService.cipherCanBeShared$.mockReturnValue(canBeShared.asObservable());

    await TestBed.configureTestingModule({
      imports: [host],
      providers: [
        { provide: ShareLinkService, useValue: shareLinkService },
        { provide: ShareItemService, useValue: shareItemService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    canBeShared = new BehaviorSubject(true);
    shareItemService = mock<ShareItemService>();
  });

  describe("without a menu", () => {
    const button = (fixture: ComponentFixture<PlainHostComponent>) =>
      fixture.debugElement.query(By.css("button"));

    it("renders the item when the cipher can be shared", async () => {
      const fixture = await render(PlainHostComponent);

      expect(button(fixture)).not.toBeNull();
    });

    it("renders nothing when the cipher cannot be shared, so hosts need no condition", async () => {
      const fixture = await render(PlainHostComponent);

      canBeShared.next(false);
      fixture.detectChanges();

      expect(button(fixture)).toBeNull();
    });

    it("starts the share flow when activated", async () => {
      const fixture = await render(PlainHostComponent);

      button(fixture).nativeElement.click();
      await fixture.whenStable();

      expect(shareItemService.share).toHaveBeenCalledWith(fixture.componentInstance.cipher);
    });
  });

  describe("inside a menu", () => {
    const menu = (fixture: ComponentFixture<MenuHostComponent>) =>
      fixture.debugElement.query(By.directive(MenuComponent)).injector.get(MenuComponent);

    /**
     * `bit-menu` collects its items with a content query, which does not reach into a child
     * component's template. Stamping the item out from the host's own template is what keeps it in
     * the menu's `FocusKeyManager` — render it from a component instead and arrow-key navigation
     * silently skips it. This is the reason this is a directive rather than a component.
     */
    it("registers with the enclosing menu so arrow-key navigation reaches it", async () => {
      const fixture = await render(MenuHostComponent);

      expect(menu(fixture).menuItems().length).toBe(2);
    });

    it("leaves the menu's other items alone when the item is hidden", async () => {
      const fixture = await render(MenuHostComponent);

      canBeShared.next(false);
      fixture.detectChanges();

      expect(menu(fixture).menuItems().length).toBe(1);
    });
  });
});
