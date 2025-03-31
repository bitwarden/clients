// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ValidatorFn, Validators } from "@angular/forms";
import { distinctUntilChanged, map, pairwise, pipe, skipWhile, startWith, takeWhile } from "rxjs";

import { AnyConstraint, Constraints } from "@bitwarden/common/tools/types";
import { UserId } from "@bitwarden/common/types/guid";
import { CredentialGeneratorConfiguration } from "@bitwarden/generator-core";

export function completeOnAccountSwitch() {
  return pipe(
    map(({ id }: { id: UserId | null }) => id),
    skipWhile((id) => !id),
    startWith(null as UserId),
    pairwise(),
    takeWhile(([prev, next]) => (prev ?? next) === next),
    map(([_, id]) => id),
    distinctUntilChanged(),
  );
}

export function toValidators<Policy, Settings>(
  target: keyof Settings,
  configuration: CredentialGeneratorConfiguration<Settings, Policy>,
  policy?: Constraints<Settings>,
) {
  const validators: Array<ValidatorFn> = [];

  // widen the types to avoid typecheck issues
  const config: AnyConstraint = configuration.settings.constraints[target];
  const runtime: AnyConstraint = policy[target];

  const required = getConstraint("required", config, runtime) ?? false;
  if (required) {
    validators.push(Validators.required);
  }

  const maxLength = getConstraint("maxLength", config, runtime);
  if (maxLength !== undefined) {
    validators.push(Validators.maxLength(maxLength));
  }

  const minLength = getConstraint("minLength", config, runtime);
  if (minLength !== undefined) {
    validators.push(Validators.minLength(config.minLength));
  }

  const min = getConstraint("min", config, runtime);
  if (min !== undefined) {
    validators.push(Validators.min(min));
  }

  const max = getConstraint("max", config, runtime);
  if (max !== undefined) {
    validators.push(Validators.max(max));
  }

  return validators;
}

function getConstraint<Key extends keyof AnyConstraint>(
  key: Key,
  config: AnyConstraint,
  policy?: AnyConstraint,
) {
  if (policy && key in policy) {
    return policy[key] ?? config[key];
  } else if (config && key in config) {
    return config[key];
  }
}
