import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nKeyOrLiteral } from "@bitwarden/common/tools/types";
import { isI18nKey } from "@bitwarden/common/tools/util";
import { AlgorithmInfo, AlgorithmMetadata } from "@bitwarden/generator-core";

/** Adapts {@link AlgorithmMetadata} to legacy {@link AlgorithmInfo} structure. */
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

/** Translates an internationalization key
 *  @param key the key to translate
 *  @param i18n the service providing translations
 *  @returns the translated key; if the key is a literal the literal
 *   is returned instead.
 */
export function translate(key: I18nKeyOrLiteral, i18n: I18nService) {
  return isI18nKey(key) ? i18n.t(key) : key.literal;
}

/** Returns true when min < max
 *  @param min the minimum value to check; when this is nullish it becomes 0.
 *  @param max the maximum value to check; when this is nullish it becomes +Infinity.
 */
export function hasRangeOfValues(min?: number, max?: number) {
  const minimum = min ?? 0;
  const maximum = max ?? Number.POSITIVE_INFINITY;
  return minimum < maximum;
}
