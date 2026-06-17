import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  output,
  signal,
  viewChild,
} from "@angular/core";

export interface PaletteAction {
  id: string;
  label: string;
  section: "navigation" | "action" | "item";
  icon: string;
  shortcut?: string;
}

const BUILTIN_ACTIONS: PaletteAction[] = [
  { id: "nav:all", label: "All items", section: "navigation", icon: "grid", shortcut: "⌘1" },
  { id: "nav:logins", label: "Logins", section: "navigation", icon: "key" },
  { id: "nav:cards", label: "Cards", section: "navigation", icon: "card" },
  { id: "nav:identities", label: "Identities", section: "navigation", icon: "user" },
  { id: "nav:notes", label: "Secure notes", section: "navigation", icon: "note" },
  { id: "nav:favorites", label: "Favorites", section: "navigation", icon: "star" },
  { id: "act:lock", label: "Lock vault", section: "action", icon: "lock", shortcut: "⌘L" },
  { id: "act:new", label: "New item", section: "action", icon: "plus", shortcut: "⌘N" },
];

@Component({
  selector: "kls-command-palette",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-start tw-justify-center tw-pt-[15vh]",
    "(click)": "onBackdropClick($event)",
    "(keydown.escape)": "close.emit()",
  },
  template: `
    <!-- Backdrop -->
    <div
      class="tw-absolute tw-inset-0"
      style="background-color: var(--fk-overlay-bg); backdrop-filter: blur(var(--fk-blur-overlay)); -webkit-backdrop-filter: blur(var(--fk-blur-overlay))"
    ></div>

    <!-- Palette panel -->
    <div
      class="tw-relative tw-flex tw-w-full tw-max-w-[560px] tw-flex-col tw-overflow-hidden tw-rounded-[var(--fk-radius-xl)]"
      style="background-color: var(--fk-card-bg); border: var(--fk-glass-border-strong); box-shadow: var(--fk-elev-panel), var(--fk-glass-highlight); backdrop-filter: blur(var(--fk-blur-chrome)) saturate(1.8); -webkit-backdrop-filter: blur(var(--fk-blur-chrome)) saturate(1.8)"
    >
      <!-- Search input -->
      <div class="tw-flex tw-items-center tw-gap-3 tw-px-5 tw-py-4" style="border-bottom: var(--fk-glass-border)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="tw-shrink-0 tw-text-fg-body-subtle" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.75" />
          <path d="m20 20-3-3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
        </svg>
        <input
          #searchInput
          type="text"
          placeholder="Type a command or search…"
          class="tw-flex-1 tw-bg-transparent tw-text-[15px] tw-text-fg-heading tw-placeholder-fg-body-subtle tw-outline-none"
          [value]="searchQuery()"
          (input)="searchQuery.set($any($event.target).value)"
          (keydown.arrowdown)="onArrowDown($event)"
          (keydown.arrowup)="onArrowUp($event)"
          (keydown.enter)="onEnter()"
        />
        <kbd
          class="tw-rounded-[var(--fk-radius-sm)] tw-px-2 tw-py-1 tw-text-[11px] tw-font-medium tw-text-fg-body-subtle"
          style="background-color: var(--fk-hover-bg); border: var(--fk-glass-border)"
        >ESC</kbd>
      </div>

      <!-- Results list -->
      <div class="tw-max-h-[320px] tw-overflow-y-auto tw-p-2">
        @for (section of sections(); track section.title) {
          <div class="tw-px-3 tw-pb-1 tw-pt-3 tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-fg-body-subtle">
            {{ section.title }}
          </div>
          @for (action of section.actions; track action.id; let i = $index) {
            <button
              type="button"
              class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-[var(--fk-radius-md)] tw-px-3 tw-py-2.5 tw-text-left tw-text-[13px]"
              [style.transition]="'all var(--fk-dur-fast) var(--fk-ease)'"
              [style.background-color]="isHighlighted(action.id) ? 'var(--fk-selected-bg)' : 'transparent'"
              [style.border]="isHighlighted(action.id) ? 'var(--fk-glass-border)' : '1px solid transparent'"
              [class.tw-text-fg-heading]="isHighlighted(action.id)"
              [class.tw-text-fg-body]="!isHighlighted(action.id)"
              (mouseenter)="highlightedId.set(action.id)"
              (click)="onSelect(action)"
            >
              <span
                class="tw-flex tw-size-7 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-[var(--fk-radius-md)]"
                [style.background-color]="isHighlighted(action.id) ? 'var(--fk-card-bg)' : 'transparent'"
                [class.tw-text-fg-brand]="isHighlighted(action.id)"
                [class.tw-text-fg-body-subtle]="!isHighlighted(action.id)"
              >
                @switch (action.icon) {
                  @case ("grid") {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.75"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.75"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.75"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.75"/></svg>
                  }
                  @case ("key") {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="10" r="4" stroke="currentColor" stroke-width="1.75"/><path d="M11 11l8 8m-3 0 3-3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
                  }
                  @case ("card") {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2.5" stroke="currentColor" stroke-width="1.75"/><path d="M2 10h20" stroke="currentColor" stroke-width="1.75"/></svg>
                  }
                  @case ("user") {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.75"/><path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
                  }
                  @case ("note") {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2.5" stroke="currentColor" stroke-width="1.75"/><path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
                  }
                  @case ("star") {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19l1-5.8L3.5 9.2l5.9-.9L12 3Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>
                  }
                  @case ("lock") {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.75"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
                  }
                  @case ("plus") {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
                  }
                  @default {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.75"/><path d="m20 20-3-3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
                  }
                }
              </span>
              <span class="tw-flex-1 tw-truncate">{{ action.label }}</span>
              @if (action.shortcut) {
                <kbd
                  class="tw-text-[11px] tw-font-medium tw-text-fg-body-subtle"
                >{{ action.shortcut }}</kbd>
              }
            </button>
          }
        }

        @if (filteredActions().length === 0) {
          <div class="tw-px-3 tw-py-8 tw-text-center tw-text-[13px] tw-text-fg-body-subtle">
            No results for "{{ searchQuery() }}"
          </div>
        }
      </div>
    </div>
  `,
})
export class KlsCommandPaletteComponent {
  readonly close = output<void>();
  readonly execute = output<PaletteAction>();

  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>("searchInput");

  protected readonly searchQuery = signal("");
  protected readonly highlightedId = signal<string>(BUILTIN_ACTIONS[0].id);

  protected readonly filteredActions = computed<PaletteAction[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) {
      return BUILTIN_ACTIONS;
    }
    return BUILTIN_ACTIONS.filter((a) => a.label.toLowerCase().includes(q));
  });

  protected readonly sections = computed(() => {
    const actions = this.filteredActions();
    const groups: { title: string; actions: PaletteAction[] }[] = [];
    const nav = actions.filter((a) => a.section === "navigation");
    const act = actions.filter((a) => a.section === "action");
    if (nav.length > 0) {
      groups.push({ title: "Navigation", actions: nav });
    }
    if (act.length > 0) {
      groups.push({ title: "Actions", actions: act });
    }
    return groups;
  });

  protected isHighlighted(id: string): boolean {
    return this.highlightedId() === id;
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  protected onSelect(action: PaletteAction): void {
    this.execute.emit(action);
    this.close.emit();
  }

  protected onArrowDown(event: Event): void {
    event.preventDefault();
    const actions = this.filteredActions();
    const idx = actions.findIndex((a) => a.id === this.highlightedId());
    if (idx < actions.length - 1) {
      this.highlightedId.set(actions[idx + 1].id);
    }
  }

  protected onArrowUp(event: Event): void {
    event.preventDefault();
    const actions = this.filteredActions();
    const idx = actions.findIndex((a) => a.id === this.highlightedId());
    if (idx > 0) {
      this.highlightedId.set(actions[idx - 1].id);
    }
  }

  protected onEnter(): void {
    const action = this.filteredActions().find((a) => a.id === this.highlightedId());
    if (action) {
      this.onSelect(action);
    }
  }

  @HostListener("document:keydown.meta.k", ["$event"])
  @HostListener("document:keydown.control.k", ["$event"])
  protected onGlobalOpen(event: Event): void {
    event.preventDefault();
  }

  ngAfterViewInit(): void {
    this.searchInputRef()?.nativeElement.focus();
  }
}
