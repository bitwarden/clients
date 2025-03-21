import { Jsonify } from "type-fest";

import { Classifier } from "../../state/classifier";

import { EcsFormat } from "./core";

/** Removes all properties except ECS properties and the listed properties.
 */
export class EcsClassifier<LogFormat extends EcsFormat>
  implements Classifier<LogFormat, unknown, unknown>
{
  classify(value: LogFormat): { disclosed: never; secret: never } {
    throw new Error("Method not implemented.");
  }
  declassify(disclosed: never, secret: never): Jsonify<LogFormat> {
    throw new Error("Method not implemented.");
  }
}
