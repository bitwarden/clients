import { distinctUntilChanged, map, pairwise, pipe, skipWhile, startWith, takeWhile } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nKeyOrLiteral } from "@bitwarden/common/tools/types";
import { isI18nKey } from "@bitwarden/common/tools/util";
import { UserId } from "@bitwarden/common/types/guid";
import { AlgorithmInfo, AlgorithmMetadata } from "@bitwarden/generator-core";

export function completeOnAccountSwitch() {
  return pipe(
    map(({ id }: { id: UserId | null }) => id),
    skipWhile((id) => !id),
    startWith(null as UserId | null),
    pairwise(),
    takeWhile(([prev, next]) => (prev ?? next) === next),
    map(([_, id]) => id),
    distinctUntilChanged(),
  );
}

export function toAlgorithmInfo(metadata: AlgorithmMetadata, i18n: I18nService) {
  const info: AlgorithmInfo = {
    id: metadata.id,
    type: metadata.type,
    name: translate(metadata.i18nKeys.name, i18n),
    generate: translate(metadata.i18nKeys.generateCredential, i18n),
    onGeneratedMessage: translate(metadata.i18nKeys.credentialGenerated, i18n),
    credentialType: translate(metadata.i18nKeys.credentialType, i18n),
    copy: translate(metadata.i18nKeys.copyCredential, i18n),
    useGeneratedValue: translate(metadata.i18nKeys.useCredential, i18n),
    onlyOnRequest: !metadata.capabilities.autogenerate,
    request: metadata.capabilities.fields,
  };

  if (metadata.i18nKeys.description) {
    info.description = translate(metadata.i18nKeys.description, i18n);
  }

  return info;
}

export function translate(key: I18nKeyOrLiteral, i18n: I18nService) {
  return isI18nKey(key) ? i18n.t(key) : key.literal;
}
