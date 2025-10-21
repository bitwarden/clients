import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { map, ReplaySubject, skip, Subject, takeUntil, withLatestFrom } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import {
  CredentialGeneratorService,
  BuiltIn,
  SubaddressGenerationOptions,
} from "@bitwarden/generator-core";

/** Options group for plus-addressed emails */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-subaddress-settings",
  templateUrl: "subaddress-settings.component.html",
  standalone: false,
})
export class SubaddressSettingsComponent implements OnInit, OnChanges, OnDestroy {
  /** Instantiates the component
   *  @param generatorService settings and policy logic
   *  @param formBuilder reactive form controls
   */
  constructor(
    private formBuilder: FormBuilder,
    private generatorService: CredentialGeneratorService,
  ) {}

  /** Binds the component to a specific user's settings.
   *  @remarks this is initialized to null but since it's a required input it'll
   *     never have that value in practice.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true })
  account: Account = null!;

  protected account$ = new ReplaySubject<Account>(1);

  async ngOnChanges(changes: SimpleChanges) {
    if ("account" in changes && changes.account) {
      this.account$.next(this.account);
    }
  }

  /** Emits settings updates and completes if the settings become unavailable.
   * @remarks this does not emit the initial settings. If you would like
   *   to receive live settings updates including the initial update,
   *   use `CredentialGeneratorService.settings(...)` instead.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  readonly onUpdated = new EventEmitter<SubaddressGenerationOptions>();

  /** The template's control bindings */
  protected settings = this.formBuilder.group({
    subaddressEmail: [""],
  });

  async ngOnInit() {
    const settings = await this.generatorService.settings(BuiltIn.plusAddress, {
      account$: this.account$,
    });

    settings.pipe(takeUntil(this.destroyed$)).subscribe((s) => {
      this.settings.patchValue(s, { emitEvent: false });
    });

    // the first emission is the current value; subsequent emissions are updates
    settings.pipe(skip(1), takeUntil(this.destroyed$)).subscribe(this.onUpdated);

    this.saveSettings
      .pipe(
        withLatestFrom(this.settings.valueChanges),
        map(([, settings]) => settings as SubaddressGenerationOptions),
        takeUntil(this.destroyed$),
      )
      .subscribe(settings);
  }

  private saveSettings = new Subject<string>();
  save(site: string = "component api call") {
    this.saveSettings.next(site);
  }

  private readonly destroyed$ = new Subject<void>();
  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }
}
