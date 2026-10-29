import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { GovernedSharedFolderIconComponent } from "./governed-shared-folder-icon.component";

describe("GovernedSharedFolderIconComponent", () => {
  let fixture: ComponentFixture<GovernedSharedFolderIconComponent>;
  let enabled$: BehaviorSubject<boolean>;

  function create(hasEnabledAccessRule: boolean): void {
    fixture = TestBed.createComponent(GovernedSharedFolderIconComponent);
    fixture.componentRef.setInput("collection", { hasEnabledAccessRule } as CollectionView);
    fixture.detectChanges();
  }

  function lock(): HTMLElement | null {
    return fixture.nativeElement.querySelector("bit-icon");
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(enabled$);
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      imports: [GovernedSharedFolderIconComponent],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: I18nService, useValue: i18nService },
      ],
    });
  });

  it("shows the lock on a folder governed by an enabled rule", () => {
    create(true);

    expect(lock()).not.toBeNull();
  });

  it("renders nothing for a folder without an enabled rule", () => {
    create(false);

    expect(lock()).toBeNull();
  });

  it("renders nothing while PAM's flag is off", () => {
    enabled$.next(false);
    create(true);

    expect(lock()).toBeNull();
  });
});
