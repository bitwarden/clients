import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Observable, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The header's item count in isolation — `VaultComponent`'s spec removes `PopupHeaderComponent`.
 * `cipherCount$` never emits synchronously, and `translate` leaves `__$1__` raw for a null arg.
 */
@Component({
  imports: [I18nPipe, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span>{{ "itemCount" | i18n: (cipherCount$ | async) ?? 0 }}</span>`,
})
class ItemCountHostComponent {
  cipherCount$: Observable<number> = of();
}

describe("header item count", () => {
  const render = (cipherCount$: Observable<number>) => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: I18nService,
          useValue: {
            // Mirrors `TranslationService.translate`, which leaves the token for a null argument.
            t: (key: string, p1: unknown) => (p1 == null ? "__$1__ items" : `${p1} items`),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ItemCountHostComponent);
    fixture.componentInstance.cipherCount$ = cipherCount$;
    fixture.detectChanges();
    return fixture.nativeElement.textContent.trim();
  };

  it("renders no placeholder token before the count resolves", () => {
    // An observable that has not emitted, as the cipher list has not on first paint.
    expect(render(of())).toBe("0 items");
  });

  it("renders the count once it resolves", () => {
    expect(render(of(39))).toBe("39 items");
  });
});
