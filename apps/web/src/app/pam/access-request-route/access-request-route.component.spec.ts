import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";

import { AccessRequestRouteComponent } from "./access-request-route.component";

describe("AccessRequestRouteComponent", () => {
  let fixture: ComponentFixture<AccessRequestRouteComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessRequestRouteComponent, RouterTestingModule],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    fixture = TestBed.createComponent(AccessRequestRouteComponent);
  });

  it("redirects to /pam/approver-inbox with replaceUrl", async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledWith(["/pam/approver-inbox"], {
      replaceUrl: true,
    });
  });
});
