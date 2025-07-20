import { computed, effect, inject, Injectable, signal, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import {
  KeyDefinition,
  StateProvider,
  VAULT_SETTINGS_DISK,
} from "@bitwarden/common/platform/state";

import { VaultPopupItemsService } from "./vault-popup-items.service";

export type PopupSectionOpen = {
  favorites: boolean;
  allItems: boolean;
};

const SECTION_OPEN_KEY = new KeyDefinition<PopupSectionOpen>(VAULT_SETTINGS_DISK, "sectionOpen", {
  deserializer: (obj) => obj,
});

const INITIAL_OPEN: PopupSectionOpen = {
  favorites: true,
  allItems: true,
};

@Injectable({
  providedIn: "root",
})
export class VaultPopupSectionService {
  private vaultPopupItemsService = inject(VaultPopupItemsService);
  private stateProvider = inject(StateProvider);

  private hasFilterOrSearchApplied = toSignal(
    this.vaultPopupItemsService.hasFilterApplied$.pipe(map((hasFilter) => hasFilter)),
  );

  /**
   * Used to change the open/close state without persisting it to the local disk. Reflects
   * application-applied overrides.
   * `null` means there is no current override
   */
  private temporaryStateOverride = signal<Partial<PopupSectionOpen> | null>(null);

  constructor() {
    effect(
      () => {
        /**
         * auto-open all sections when search or filter is applied, and remove
         * override when search or filter is removed
         */
        if (this.hasFilterOrSearchApplied()) {
          this.temporaryStateOverride.set(INITIAL_OPEN);
        } else {
          this.temporaryStateOverride.set(null);
        }
      },
      {
        allowSignalWrites: true,
      },
    );
  }

  /**
   * Stored disk state for the open/close state of the sections. Will be `null` if user has never
   * opened/closed a section
   */
  private sectionOpenStateProvider = this.stateProvider.getGlobal(SECTION_OPEN_KEY);

  /**
   * Stored disk state for the open/close state of the sections, with an initial value provided
   * if the stored disk state does not yet exist.
   */
  private sectionOpenStoredState = toSignal<PopupSectionOpen | null>(
    this.sectionOpenStateProvider.state$.pipe(map((sectionOpen) => sectionOpen ?? INITIAL_OPEN)),
    // Indicates that the state value is loading
    { initialValue: null },
  );

  /**
   * Indicates the current open/close display state of each section, accounting for temporary
   * non-persisted overrides.
   */
  sectionOpenDisplayState: Signal<Partial<PopupSectionOpen>> = computed(() => ({
    ...this.sectionOpenStoredState(),
    ...this.temporaryStateOverride(),
  }));

  /**
   * Retrieve the open/close display state for a given section.
   *
   * @param sectionKey section key
   */
  getOpenDisplayStateForSection(sectionKey: keyof PopupSectionOpen): Signal<boolean | undefined> {
    return computed(() => this.sectionOpenDisplayState()?.[sectionKey]);
  }

  /**
   * Updates the stored open/close state of a given section. Should be called only when a user action
   * is taken directly to change the open/close state.
   *
   * Removes any current temporary override for the given section, as direct user action should
   * supersede any application-applied overrides.
   *
   * @param sectionKey section key
   */
  async updateSectionOpenStoredState(
    sectionKey: keyof PopupSectionOpen,
    open: boolean,
  ): Promise<void> {
    await this.sectionOpenStateProvider.update((currentState) => {
      return {
        ...(currentState ?? INITIAL_OPEN),
        [sectionKey]: open,
      };
    });

    this.temporaryStateOverride.update((prev) => {
      if (prev !== null) {
        return {
          ...prev,
          [sectionKey]: open,
        };
      }

      return prev;
    });
  }
}
