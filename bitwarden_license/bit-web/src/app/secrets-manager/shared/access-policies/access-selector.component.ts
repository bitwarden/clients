import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatest,
  firstValueFrom,
  map,
  Observable,
  share,
  Subject,
  switchMap,
  tap,
} from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SelectItemView } from "@bitwarden/components/src/multi-select/models/select-item-view";

import { BaseAccessPolicyView } from "../../models/view/access-policy.view";

import { AccessPolicyService } from "./access-policy.service";

export type AccessSelectorRowView = {
  type: "user" | "group" | "serviceAccount" | "project";
  name: string;
  id: string;
  accessPolicyId: string;
  read: boolean;
  write: boolean;
  icon: string;
  userId?: string;
  currentUserInGroup?: boolean;
  static?: boolean;
};

@Component({
  selector: "sm-access-selector",
  templateUrl: "./access-selector.component.html",
})
export class AccessSelectorComponent implements OnInit {
  static readonly userIcon = "bwi-user";
  static readonly groupIcon = "bwi-family";
  static readonly serviceAccountIcon = "bwi-wrench";
  static readonly projectIcon = "bwi-collection";

  /**
   * Emits the selected items on submit.
   */
  @Output() onCreateAccessPolicies = new EventEmitter<SelectItemView[]>();
  @Output() onDeleteAccessPolicy = new EventEmitter<AccessSelectorRowView>();
  @Output() onUpdateAccessPolicy = new EventEmitter<AccessSelectorRowView>();

  @Input() label: string;
  @Input() hint: string;
  @Input() columnTitle: string;
  @Input() emptyMessage: string;
  @Input() granteeType: "people" | "serviceAccounts" | "projects";

  protected rows$ = new Subject<AccessSelectorRowView[]>();
  @Input() private set rows(value: AccessSelectorRowView[]) {
    const sorted = value.sort((a, b) => {
      if (a.icon == b.icon) {
        return a.name.localeCompare(b.name);
      }
      if (a.icon == AccessSelectorComponent.userIcon) {
        return -1;
      }
      return 1;
    });
    this.rows$.next(sorted);
  }

  private maxLength = 15;
  protected formGroup = new FormGroup({
    multiSelect: new FormControl([], [Validators.required, Validators.maxLength(this.maxLength)]),
  });
  protected loading = true;

  protected selectItems$: Observable<SelectItemView[]> = combineLatest([
    this.rows$,
    this.route.params,
  ]).pipe(
    switchMap(([rows, params]) =>
      this.getPotentialGrantees(params.organizationId).then((grantees) =>
        grantees
          .filter((g) => !rows.some((row) => row.id === g.id))
          .map((granteeView) => {
            let icon: string;
            let listName = granteeView.name;
            let labelName = granteeView.name;
            if (granteeView.type === "user") {
              icon = AccessSelectorComponent.userIcon;
              if (Utils.isNullOrWhitespace(granteeView.name)) {
                listName = granteeView.email;
                labelName = granteeView.email;
              } else {
                listName = `${granteeView.name} (${granteeView.email})`;
              }
            } else if (granteeView.type === "group") {
              icon = AccessSelectorComponent.groupIcon;
            } else if (granteeView.type === "serviceAccount") {
              icon = AccessSelectorComponent.serviceAccountIcon;
            } else if (granteeView.type === "project") {
              icon = AccessSelectorComponent.projectIcon;
            }
            return {
              icon: icon,
              id: granteeView.id,
              labelName: labelName,
              listName: listName,
            };
          })
      )
    ),
    map((selectItems) => selectItems.sort((a, b) => a.listName.localeCompare(b.listName))),
    tap(() => {
      this.loading = false;
      this.formGroup.reset();
      this.formGroup.enable();
    }),
    share()
  );

  constructor(private accessPolicyService: AccessPolicyService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.formGroup.disable();
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }
    this.formGroup.disable();
    this.loading = true;

    this.onCreateAccessPolicies.emit(this.formGroup.value.multiSelect);

    return firstValueFrom(this.selectItems$);
  };

  async update(target: any, row: AccessSelectorRowView): Promise<void> {
    if (target.value === "canRead") {
      row.read = true;
      row.write = false;
    } else if (target.value === "canReadWrite") {
      row.read = true;
      row.write = true;
    }
    this.onUpdateAccessPolicy.emit(row);
  }

  delete = (row: AccessSelectorRowView) => async () => {
    this.loading = true;
    this.formGroup.disable();
    this.onDeleteAccessPolicy.emit(row);
    return firstValueFrom(this.selectItems$);
  };

  private getPotentialGrantees(organizationId: string) {
    switch (this.granteeType) {
      case "people":
        return this.accessPolicyService.getPeoplePotentialGrantees(organizationId);
      case "serviceAccounts":
        return this.accessPolicyService.getServiceAccountsPotentialGrantees(organizationId);
      case "projects":
        return this.accessPolicyService.getProjectsPotentialGrantees(organizationId);
    }
  }

  static getAccessItemType(item: SelectItemView) {
    switch (item.icon) {
      case AccessSelectorComponent.userIcon:
        return "user";
      case AccessSelectorComponent.groupIcon:
        return "group";
      case AccessSelectorComponent.serviceAccountIcon:
        return "serviceAccount";
      case AccessSelectorComponent.projectIcon:
        return "project";
    }
  }

  static getBaseAccessPolicyView(row: AccessSelectorRowView) {
    const view = new BaseAccessPolicyView();
    view.id = row.accessPolicyId;
    view.read = row.read;
    view.write = row.write;
    return view;
  }
}
