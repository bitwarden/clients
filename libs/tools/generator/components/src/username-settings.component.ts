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
  EffUsernameGenerationOptions,
  BuiltIn,
} from "@bitwarden/generator-core";

/** Options group for usernames */
@Component({
  selector: "tools-username-settings",
  templateUrl: "username-settings.component.html",
  standalone: false,
})
export class UsernameSettingsComponent implements OnInit, OnChanges, OnDestroy {
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
  @Input({ required: true })
  account: Account = null!;

  protected account$ = new ReplaySubject<Account>(1);

  async ngOnChanges(changes: SimpleChanges) {
    if ("account" in changes) {
      this.account$.next(this.account);
    }
  }

  /** Emits settings updates and completes if the settings become unavailable.
   * @remarks this does not emit the initial settings. If you would like
   *   to receive live settings updates including the initial update,
   *   use `CredentialGeneratorService.settings(...)` instead.
   */
  @Output()
  readonly onUpdated = new EventEmitter<EffUsernameGenerationOptions>();

  /** The template's control bindings */
  protected settings = this.formBuilder.group({
    wordCapitalize: [false],
    wordIncludeNumber: [false],
  });

  async ngOnInit() {
    const settings = await this.generatorService.settings(BuiltIn.effWordList, {
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
        map(([, settings]) => settings as EffUsernameGenerationOptions),
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
