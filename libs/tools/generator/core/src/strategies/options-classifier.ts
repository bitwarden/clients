import { Jsonify } from "type-fest";

import { IntegrationRequest } from "@bitwarden/common/tools/integration/rpc";
import { Classifier } from "@bitwarden/common/tools/state/classifier";

/** Classifies an object by excluding IntegrationRequest parameters.
 */
export class OptionsClassifier<
  Settings,
  Options extends IntegrationRequest & Settings = IntegrationRequest & Settings,
> implements Classifier<Options, Record<string, never>, Settings>
{
  /** Partitions `secret` into its disclosed properties and secret properties.
   *  @param value The object to partition
   *  @returns an object that classifies secrets.
   *    The `disclosed` member is new and contains disclosed properties.
   *    The `secret` member is a copy of the secret parameter, including its
   *    prototype, with all disclosed and excluded properties deleted.
   */
  classify(value: Options) {
    const secret = JSON.parse(JSON.stringify(value));
    delete secret.website;
    const disclosed: Record<string, never> = {};
    return { disclosed, secret };
  }

  /** Merges the properties of `secret` and `disclosed`. When `secret` and
   *  `disclosed` contain the same property, the `secret` property overrides
   *  the `disclosed` property.
   *  @param disclosed an object whose disclosed properties are merged into
   *    the output. Unknown properties are ignored.
   *  @param secret an objects whose properties are merged into the output.
   *    Excluded properties are ignored. Unknown properties are retained.
   *  @returns a new object containing the merged data.
   *
   *  @remarks Declassified data is always jsonified--the purpose of classifying it is
   *   to Jsonify it,
   *   which causes type conversions.
   */
  declassify(_disclosed: Jsonify<Record<keyof Settings, never>>, secret: Jsonify<Settings>) {
    const result = { ...(secret as any), website: null };
    return result as Jsonify<Options>;
  }
}
