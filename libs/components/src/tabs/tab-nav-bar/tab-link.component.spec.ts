import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../../utils/i18n-mock.service";

import { TabLinkComponent } from "./tab-link.component";
import { TabNavBarComponent } from "./tab-nav-bar.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-tab-nav-bar label="Tabs">
      <bit-tab-link route="plain">Plain</bit-tab-link>
      <bit-tab-link route="scoped" [queryParams]="{ targetSystemId: 'ts-1' }">Scoped</bit-tab-link>
    </bit-tab-nav-bar>
  `,
  imports: [TabNavBarComponent, TabLinkComponent],
})
class TestHostComponent {}

describe("TabLinkComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: new I18nMockService({ more: "More" }) },
      ],
    });
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  function hrefs(): (string | null)[] {
    return fixture.debugElement
      .queryAll(By.directive(TabLinkComponent))
      .map((link) => link.nativeElement.querySelector("a").getAttribute("href"));
  }

  it("adds queryParams to the link", () => {
    expect(hrefs()[1]).toBe("/scoped?targetSystemId=ts-1");
  });

  it("leaves the link bare without queryParams", () => {
    expect(hrefs()[0]).toBe("/plain");
  });
});
