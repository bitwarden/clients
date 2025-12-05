import { Component, DestroyRef } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AsyncValidatorFn,
  FormBuilder,
  FormControl,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  BehaviorSubject,
  concatMap,
  distinctUntilChanged,
  Subject,
  map,
  filter,
  withLatestFrom,
  shareReplay,
} from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import { SharedModule } from "../../../shared";

import { SendAccessService } from "./send-access-service.abstraction";

/** Authenticates a password before redirecting to view-content
 *  @remarks - this component runs in an an anonymous layout
 */
@Component({
  selector: "anon-send-password-authentication",
  templateUrl: "password-authentication.component.html",
  imports: [SharedModule],
})
export class PasswordAuthenticationComponent {
  /** Instantiates the send password authentication component
   *  @param access authenticates the user
   *  @param router redirects to the send content screen
   *  @param route contains sendId parameter
   *  @param formBuilder constructs the reactive form
   *  @param i18nService localizes error messages
   *  @param toastService displays unexpected error notifications
   *  @param logService records errors
   *  @param destroyRef completes subscriptions
   */
  constructor(
    private access: SendAccessService,
    private router: Router,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private toastService: ToastService,
    private logService: LogService,
    private destroyRef: DestroyRef,
  ) {
    const sendId$ = this.route.params.pipe(
      map(({ sendId }) => sendId as unknown),
      filter((sendId): sendId is string => typeof sendId === "string"),
      shareReplay({ refCount: true }),
    );

    this.authenticate$
      .pipe(
        withLatestFrom(sendId$, this.formGroup.valueChanges),
        map(([, sendId, { password }]) => [sendId, password ?? ""] as const),
        concatMap((params) => this.access.authenticate$(...params)),
        // FIXME: remove type assertion once we're on a typescript version that properly infers the type
        map((success) => (success ? "success" : "failed") as "success" | "failed"),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe({
        next: (value) => this.authenticationState$.next(value),
        error: (e: unknown) => {
          this.logService.error(e);
          this.toastService.showToast({
            message: this.i18nService.t("unexpectedErrorSend"),
          });
        },
      });

    this.authenticationState$
      .pipe(
        filter((state) => state === "success"),
        withLatestFrom(sendId$),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(([, sendId]) => this.router.navigate(["send/content", sendId]));
  }

  private readonly authenticationState$ = new BehaviorSubject<"none" | "failed" | "success">(
    "none",
  );
  private readonly authenticate$ = new Subject<string>();

  private readonly passwordRequired: ValidatorFn = (control) => {
    // new inputs invalidate the last authentication attempt
    this.authenticationState$.next("none");

    if (Validators.required(control)) {
      return { password: this.i18nService.t("sendAccessInvalidPassword") };
    }

    return null;
  };

  private readonly invalidPassword: AsyncValidatorFn = async (control) => {
    // authentication is user-initiated, but when it fails it reports through
    // the field's error output
    return this.authenticationState$.pipe(
      distinctUntilChanged(),
      map((state) =>
        state === "failed" ? { password: this.i18nService.t("sendAccessInvalidPassword") } : null,
      ),
      takeUntilDestroyed(this.destroyRef),
    );
  };

  /** The component's reactive form group.
   * @remarks This is public for testing purposes only.
   */
  formGroup = this.formBuilder.group({
    password: new FormControl("", {
      validators: this.passwordRequired,
      asyncValidators: this.invalidPassword,
      updateOn: "blur",
    }),
  });

  /** triggers password authentication
   *  @param source of the authentication request
   */
  authenticate(source: string) {
    this.authenticate$.next(source);
  }
}
