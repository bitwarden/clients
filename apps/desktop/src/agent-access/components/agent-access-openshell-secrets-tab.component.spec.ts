import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { AgentAccessOpenShellSecretsTabComponent } from "./agent-access-openshell-secrets-tab.component";

// The credentials UI is built and tested on its own; here it is only a place to look for the
// sandbox name the tab hands it.
jest.mock(
  "./agent-access-openshell-credentials.component",
  () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core = require("@angular/core");
    class StubCredentials {
      sandboxName = "";
    }
    core.Component({
      selector: "app-agent-access-openshell-credentials",
      inputs: ["sandboxName"],
      template: '<span data-testid="stub-credentials">{{ sandboxName }}</span>',
      changeDetection: core.ChangeDetectionStrategy.OnPush,
    })(StubCredentials);
    return { AgentAccessOpenShellCredentialsComponent: StubCredentials };
  },
  { virtual: true },
);

describe("AgentAccessOpenShellSecretsTabComponent", () => {
  afterEach(() => TestBed.resetTestingModule());

  function render(
    name: string | null,
    paramMap = new BehaviorSubject(convertToParamMap({ name })),
  ) {
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellSecretsTabComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { parent: { paramMap, snapshot: { paramMap: paramMap.value } } },
        },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellSecretsTabComponent);
    fixture.detectChanges();
    return { fixture, paramMap };
  }

  const stub = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement.querySelector('[data-testid="stub-credentials"]');

  it("hands the parent route's sandbox name to the credentials list", () => {
    const { fixture } = render("alpha");

    expect(stub(fixture)?.textContent).toBe("alpha");
  });

  it("follows the parent route when the name changes", () => {
    const { fixture, paramMap } = render("alpha");

    paramMap.next(convertToParamMap({ name: "beta" }));
    fixture.detectChanges();

    expect(stub(fixture)?.textContent).toBe("beta");
  });

  it("renders nothing without a name", () => {
    const { fixture } = render(null);

    expect(stub(fixture)).toBeNull();
  });
});
