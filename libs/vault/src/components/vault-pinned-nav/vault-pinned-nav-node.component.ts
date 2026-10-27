import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { isActive, Router } from "@angular/router";

import { CollectionId } from "@bitwarden/common/types/guid";
import { NavigationModule } from "@bitwarden/components";

import { EXACT_PATH } from "../../routing/exact-path";

import { PinnedFolderNode } from "./pinned-shared-folder-nodes";

/**
 * One pinned shared folder in the side nav: a group with a chevron when folders are nested beneath
 * it, a plain item otherwise.
 *
 * A component of its own, rather than a recursive template, so every level is created inside the
 * group above it. The nav items find their parent group, and so their indent, through injection,
 * and a template resolves that from where it is declared rather than from where it is rendered.
 */
@Component({
  selector: "vault-pinned-nav-node",
  templateUrl: "./vault-pinned-nav-node.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavigationModule],
})
export class VaultPinnedNavNodeComponent {
  readonly node = input.required<PinnedFolderNode>();

  /**
   * Route commands for every folder in the tree, by id. Handed down rather than built per node so
   * `routerLink` gets the same array on every change detection pass.
   */
  readonly routes = input.required<ReadonlyMap<CollectionId, string[]>>();

  private readonly router = inject(Router);

  protected readonly route = computed(() => this.routes().get(this.node().id));

  /**
   * Whether this folder's own page is in view. An open group hides the active styles of its row, so
   * the group is told to keep them while its folder is the page in view.
   */
  protected readonly active = computed(() => {
    const route = this.route();
    return route != null && isActive(this.router.createUrlTree(route), this.router, EXACT_PATH)();
  });
}
