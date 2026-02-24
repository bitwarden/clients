import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { map, ReplaySubject, skip, Subject, withLatestFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { FormFieldModule } from "@bitwarden/components";
import {
  CatchallGenerationOptions,
  CredentialGeneratorService,
  BuiltIn,
} from "@bitwarden/generator-core";
import { I18nPipe } from "@bitwarden/ui-common";

/** Options group for catchall emails */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-catchall-settings",
  templateUrl: "catchall-settings.component.html",
  imports: [ReactiveFormsModule, FormFieldModule, JslibModule, I18nPipe],
})
export class CatchallSettingsComponent implements OnInit, OnDestroy, OnChanges {
  /** Instantiates the component
   *  @param generatorService settings and policy logic
   *  @param formBuilder reactive form controls
   */
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private formBuilder: FormBuilder,
    private generatorService: CredentialGeneratorService,
  ) {}

  /** Binds the component to a specific user's settings.\
   *  @remarks this is initialized to null but since it's a required input it'll
   *     never have that value in practice.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true })
  account!: Account;

  private account$ = new ReplaySubject<Account>(1);

  /** Emits settings updates and completes if the settings become unavailable.
   * @remarks this does not emit the initial settings. If you would like
   *   to receive live settings updates including the initial update,
   *   use `CredentialGeneratorService.settings(...)` instead.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  readonly onUpdated = new EventEmitter<CatchallGenerationOptions>();

  /** The template's control bindings */
  protected settings = this.formBuilder.group({
    catchallDomain: [""],
  });

  async ngOnChanges(changes: SimpleChanges) {
    if ("account" in changes && changes.account) {
      this.account$.next(this.account);
    }
  }

  async ngOnInit() {
    const settings = await this.generatorService.settings(BuiltIn.catchall, {
      account$: this.account$,
    });

    settings.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((s) => {
      this.settings.patchValue(s, { emitEvent: false });
    });

    // the first emission is the current value; subsequent emissions are updates
    settings.pipe(skip(1), takeUntilDestroyed(this.destroyRef)).subscribe(this.onUpdated);

    // now that outputs are set up, connect inputs
    this.saveSettings
      .pipe(
        withLatestFrom(this.settings.valueChanges),
        map(([, settings]) => settings as CatchallGenerationOptions),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(settings);
  }

  private saveSettings = new Subject<string>();
  save(site: string = "component api call") {
    this.saveSettings.next(site);
  }

  ngOnDestroy(): void {
    this.account$.complete();
  }
}
