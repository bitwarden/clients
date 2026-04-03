import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  CollectionAdminService,
  CollectionService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";

import { GroupApiService } from "../../../core";

import {
  CollectionDialogAction,
  CollectionDialogComponent,
  CollectionDialogParams,
} from "./collection-dialog.component";

describe("CollectionDialogComponent", () => {
  let component: CollectionDialogComponent;
  let fixture: ComponentFixture<CollectionDialogComponent>;

  let mockDialogRef: MockProxy<DialogRef<any>>;
  let mockCollectionAdminService: MockProxy<CollectionAdminService>;
  let mockOrgUserApiService: MockProxy<OrganizationUserApiService>;

  const mockOrgId = newGuid() as OrganizationId;

  const defaultParams: CollectionDialogParams = {
    organizationId: mockOrgId,
  };

  beforeEach(async () => {
    mockDialogRef = mock<DialogRef<any>>();
    mockCollectionAdminService = mock<CollectionAdminService>();
    mockCollectionAdminService.collectionAdminViews$.mockReturnValue(of([]));
    mockOrgUserApiService = mock<OrganizationUserApiService>();
    mockOrgUserApiService.getAllMiniUserDetails.mockReturnValue(of({ data: [] }) as any);

    await TestBed.configureTestingModule({
      imports: [CollectionDialogComponent],
      providers: [
        FormBuilder,
        { provide: DIALOG_DATA, useValue: defaultParams },
        {
          provide: OrganizationService,
          useValue: {
            organizations$: () =>
              of([{ canCreateNewCollections: true, name: "Organization 1", id: mockOrgId }]),
          },
        },
        { provide: GroupApiService, useValue: mock<GroupApiService>() },
        { provide: CollectionAdminService, useValue: mockCollectionAdminService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: OrganizationUserApiService, useValue: mockOrgUserApiService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: AccountService, useValue: { activeAccount$: of({ id: newGuid() } as Account) } },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: CollectionService, useValue: { encryptedCollections$: () => of([]) } },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: DialogRef, useValue: mockDialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionDialogComponent);
    component = fixture.componentInstance;
    (component as any).organizations$ = of([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("backAction getter", () => {
    const backButton = () =>
      fixture.debugElement.query(By.css("[data-testid='collection-dialog-back-button']"));

    it("does not show the back button when no backAction param is provided", async () => {
      expect(backButton()).toBeNull();
    });

    describe("when backAction param is provided", () => {
      let mockBackAction: jest.Mock;

      beforeEach(async () => {
        mockBackAction = jest.fn();
        defaultParams.backAction = mockBackAction;
        await component.ngOnInit();
        fixture.detectChanges();
      });

      afterEach(() => {
        defaultParams.backAction = undefined;
      });

      it("calls the provided backAction when invoked", async () => {
        backButton()?.triggerEventHandler("click", null);

        expect(mockBackAction).toHaveBeenCalledTimes(1);
      });

      it("closes the dialog with Canceled action when invoked", async () => {
        backButton()?.triggerEventHandler("click", null);
        expect(mockDialogRef.close).toHaveBeenCalledWith({
          action: CollectionDialogAction.Canceled,
          collection: undefined,
        });
      });
    });
  });
});
