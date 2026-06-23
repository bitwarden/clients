import { TemplatePortal } from "@angular/cdk/portal";
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BitwardenIcon,
  BulkActionsBarComponent,
  BulkActionComponent,
  BulkAdditionalActionComponent,
  LayoutFooterService,
} from "@bitwarden/components";

import { VaultBatchBarService } from "../../services/vault-batch-bar.service";

type ActionDescriptor = {
  action: () => void;
  icon: BitwardenIcon;
  label: string;
  color?: string;
};

/** When the total number of available actions exceeds this, split into primary + overflow. */
const PRIMARY_ACTION_THRESHOLD = 3;
/** Number of actions shown as primary buttons before the rest move to the overflow menu. */
const PRIMARY_ACTION_COUNT = 2;

@Component({
  selector: "bit-vault-batch-action",
  templateUrl: "./vault-batch-action.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BulkActionsBarComponent, BulkActionComponent, BulkAdditionalActionComponent],
})
export class VaultBatchActionComponent implements OnDestroy {
  protected readonly service = inject(VaultBatchBarService);
  private readonly i18nService = inject(I18nService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly layoutFooter = inject(LayoutFooterService);

  private readonly barPortal = viewChild.required<TemplateRef<unknown>>("barPortal");
  private readonly portal = signal<TemplatePortal | null>(null);

  constructor() {
    // The bar is `position: fixed`, but it's used within the layout's `cdk-virtual-scrollable`
    // <main>, whose `contain: strict` establishes a containing block — so `fixed` would resolve
    // against <main> and scroll with its content instead of pinning to the viewport. Rendering
    // it into the layout's footer region (a sibling of <main>, outside the scroll container)
    // escapes that containing block while keeping the bar aligned to the main content column.
    afterNextRender(() => {
      const portal = new TemplatePortal(this.barPortal(), this.viewContainerRef);
      this.portal.set(portal);
      this.layoutFooter.attach(portal);
    });
  }

  ngOnDestroy(): void {
    const portal = this.portal();
    if (portal != null) {
      this.layoutFooter.detach(portal);
      this.portal.set(null);
    }
  }

  /** Builds the ordered list of actions the current selection is permitted to perform. */
  private readonly visibleActions = computed<ActionDescriptor[]>(() => {
    const actions: ActionDescriptor[] = [];

    if (this.service.canAddToFolder()) {
      actions.push({
        action: this.service.bulkMoveToFolder.bind(this.service),
        icon: "bwi-folder",
        label: this.i18nService.t("addToFolder"),
      });
    }
    if (this.service.canAssignToCollections()) {
      actions.push({
        action: this.service.bulkAssignToCollections.bind(this.service),
        icon: "bwi-collection",
        label: this.i18nService.t("assignToCollections"),
      });
    }
    if (this.service.canArchive()) {
      actions.push({
        action: this.service.bulkArchive.bind(this.service),
        icon: "bwi-archive",
        label: this.i18nService.t("archiveVerb"),
      });
    }
    if (this.service.canUnarchive()) {
      actions.push({
        action: this.service.bulkUnarchive.bind(this.service),
        icon: "bwi-unarchive",
        label: this.i18nService.t("unArchive"),
      });
    }
    if (this.service.canRestore()) {
      actions.push({
        action: this.service.bulkRestore.bind(this.service),
        icon: "bwi-undo",
        label: this.i18nService.t("restore"),
      });
    }
    if (this.service.canDelete()) {
      actions.push({
        action: this.service.bulkDelete.bind(this.service),
        icon: "bwi-trash",
        label: this.i18nService.t(this.service.inTrash() ? "permanentlyDelete" : "delete"),
      });
    }

    return actions;
  });

  /** Actions rendered as top-level buttons. Capped at PRIMARY_ACTION_COUNT when there are more than PRIMARY_ACTION_THRESHOLD total actions. */
  protected readonly primaryActions = computed<ActionDescriptor[]>(() => {
    const all = this.visibleActions();
    return all.length > PRIMARY_ACTION_THRESHOLD ? all.slice(0, PRIMARY_ACTION_COUNT) : all;
  });

  /** Actions hidden behind the "more" overflow menu when the total exceeds PRIMARY_ACTION_THRESHOLD. */
  protected readonly overflowActions = computed<ActionDescriptor[]>(() => {
    const all = this.visibleActions();
    return all.length > PRIMARY_ACTION_THRESHOLD ? all.slice(PRIMARY_ACTION_COUNT) : [];
  });
}
