import { ComponentFixture, TestBed } from "@angular/core/testing";

import { Icon, svgIcon } from "@bitwarden/assets/svg";

import { SvgComponent } from "./svg.component";

describe("SvgComponent", () => {
  let fixture: ComponentFixture<SvgComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SvgComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SvgComponent);
    fixture.detectChanges();
  });

  it("should have empty innerHtml when input is not an Icon", () => {
    const fakeIcon = { svg: "harmful user input" } as Icon;

    fixture.componentRef.setInput("content", fakeIcon);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.innerHTML).toBe("");
  });

  it("should contain icon when input is a safe Icon", () => {
    const icon = svgIcon`<svg><text x="0" y="15">safe icon</text></svg>`;

    fixture.componentRef.setInput("content", icon);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.innerHTML).toBe(`<svg><text x="0" y="15">safe icon</text></svg>`);
  });
});
