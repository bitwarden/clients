import { Component, EventEmitter, Output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GeneratorModule } from "@bitwarden/generator-components";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-password-generator",
  template: `<ng-content></ng-content>`,
})
class MockPasswordGeneratorComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onGenerated = new EventEmitter();
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-username-generator",
  template: `<ng-content></ng-content>`,
})
class MockUsernameGeneratorComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onGenerated = new EventEmitter();
}

describe("CipherFormGeneratorComponent", () => {
  let component: CipherFormGeneratorComponent;
  let fixture: ComponentFixture<CipherFormGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CipherFormGeneratorComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
      // FIXME(PM-18598): Replace unknownElements and unknownProperties with actual imports
      errorOnUnknownProperties: false,
    })
      .overrideComponent(CipherFormGeneratorComponent, {
        remove: { imports: [GeneratorModule] },
        add: { imports: [MockPasswordGeneratorComponent, MockUsernameGeneratorComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CipherFormGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("password generation", () => {
    let passwordGenerator: MockPasswordGeneratorComponent;

    beforeEach(() => {
      component.type = "password";
      fixture.detectChanges();

      passwordGenerator = fixture.debugElement.query(
        By.directive(MockPasswordGeneratorComponent),
      ).componentInstance;
    });

    it("only shows `PasswordGeneratorComponent`", () => {
      expect(passwordGenerator).toBeTruthy();
      expect(fixture.debugElement.query(By.directive(MockUsernameGeneratorComponent))).toBeNull();
    });

    it("invokes `valueGenerated` with the generated credential", () => {
      jest.spyOn(component.valueGenerated, "emit");

      passwordGenerator.onGenerated.emit({ credential: "new-cred-password!" });

      expect(component.valueGenerated.emit).toHaveBeenCalledTimes(1);
      expect(component.valueGenerated.emit).toHaveBeenCalledWith("new-cred-password!");
    });
  });

  describe("username generation", () => {
    let usernameGenerator: MockUsernameGeneratorComponent;

    beforeEach(() => {
      component.type = "username";
      fixture.detectChanges();

      usernameGenerator = fixture.debugElement.query(
        By.directive(MockUsernameGeneratorComponent),
      ).componentInstance;
    });

    it("only shows `UsernameGeneratorComponent`", () => {
      expect(usernameGenerator).toBeTruthy();
      expect(fixture.debugElement.query(By.directive(MockPasswordGeneratorComponent))).toBeNull();
    });

    it("invokes `valueGenerated` with the generated credential", () => {
      jest.spyOn(component.valueGenerated, "emit");

      usernameGenerator.onGenerated.emit({ credential: "new-cred-username!" });

      expect(component.valueGenerated.emit).toHaveBeenCalledTimes(1);
      expect(component.valueGenerated.emit).toHaveBeenCalledWith("new-cred-username!");
    });
  });
});
