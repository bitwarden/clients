import {
  ChangeDetectionStrategy,
  Component,
  ViewContainerRef,
  signal,
  viewChild,
} from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { FilterMenuComponent } from "./filter-menu.component";
import { FilterOptionComponent } from "./filter-option.component";

const mockI18nService = { t: (key: string) => key };

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterOptionComponent],
  template: `
    <bit-filter-menu key="test" placeholderText="Test" multiple>
      <ng-container #anchor></ng-container>
      @for (value of readyValues(); track value) {
        <bit-filter-option [value]="value">{{ value }}</bit-filter-option>
      }
    </bit-filter-menu>
  `,
})
class TestHostComponent {
  readonly anchor = viewChild.required("anchor", { read: ViewContainerRef });
  readonly readyValues = signal<string[]>([]);
}

describe("FilterMenuComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let menu: FilterMenuComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    menu = fixture.debugElement.query(By.directive(FilterMenuComponent)).componentInstance;
  });

  it("skips an option whose required `value` input hasn't bound yet, instead of throwing NG0950", () => {
    // Simulates the real-world race: an option lands in the content-projected DOM (e.g. an
    // async collections list appending a row) a tick before Angular binds its `value` input.
    const optionRef = host.anchor().createComponent(FilterOptionComponent);
    expect(() => optionRef.instance.value()).toThrow(/NG0950/);

    menu.setValue(["abc"]);

    expect(() => fixture.detectChanges()).not.toThrow();

    optionRef.destroy();
  });

  it("picks up a late-added option's selection once its value resolves", () => {
    menu.setValue(["abc"]);
    fixture.detectChanges();
    expect(menu.summary()).toBe("");

    host.readyValues.set(["abc"]);
    fixture.detectChanges();

    expect(menu.isSelected("abc")).toBe(true);
    expect(menu.summary()).toBe("abc");
  });
});
