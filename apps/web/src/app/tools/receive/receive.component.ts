import { Component, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NoResults, NoSendsIcon } from "@bitwarden/assets/svg";
import {
  ButtonModule,
  DialogService,
  NoItemsModule,
  SearchModule,
  SpinnerComponent,
  TableDataSource,
  ToggleGroupModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";

import { ReceiveAddEditComponent } from "./receive-add-edit.component";
import { ReceiveTableComponent } from "./receive-table.component";
import { ReceiveListState, ReceiveView } from "./receive-view";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-receive",
  templateUrl: "receive.component.html",
  imports: [
    FormsModule,
    I18nPipe,
    JslibModule,
    ButtonModule,
    SearchModule,
    NoItemsModule,
    SpinnerComponent,
    HeaderModule,
    ToggleGroupModule,
    ReceiveTableComponent,
  ],
})
export class ReceiveComponent {
  constructor(private readonly dialogService: DialogService) {}

  openNewReceiveDrawer(): void {
    this.dialogService.openDrawer(ReceiveAddEditComponent, { closeOnNavigation: true });
  }

  protected readonly noItemIcon = NoSendsIcon;
  protected readonly noResultsIcon = NoResults;
  protected readonly ReceiveListState = ReceiveListState;

  protected readonly loading = signal(false);
  protected readonly listState = signal<ReceiveListState | null>(ReceiveListState.Empty);
  protected readonly currentSearchText = signal("");
  protected readonly dataSource = new TableDataSource<ReceiveView>();

  protected readonly noSearchResults = computed(
    () => true, // TODO: Implement search and update this value based on results
  );

  searchTextChanged(newSearchText: string): void {
    this.currentSearchText.set(newSearchText);
  }
}
