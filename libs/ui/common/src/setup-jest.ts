import { mock } from "jest-mock-extended";
import { setupZoneTestEnv } from "jest-preset-angular/setup-env/zone";

setupZoneTestEnv({ errorOnUnknownElements: true, errorOnUnknownProperties: true });

window.IntersectionObserver = jest.fn(() => mock<IntersectionObserver>());
