// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { Classifier } from "./state/classifier";

export class PrivateClassifier<Data> implements Classifier<Data, Record<string, never>, Data> {
  constructor(private keys: (keyof Jsonify<Data>)[] = undefined) {}

  classify(value: Data): { disclosed: Jsonify<Record<string, never>>; secret: Jsonify<Data> } {
    const pickMe = JSON.parse(JSON.stringify(value));
    const keys: (keyof Jsonify<Data>)[] = this.keys ?? (Object.keys(pickMe) as any);

    const picked: Partial<Jsonify<Data>> = {};
    for (const key of keys) {
      picked[key] = pickMe[key];
    }
    const secret = picked as Jsonify<Data>;

    return { disclosed: null, secret };
  }

  declassify(_disclosed: Jsonify<Record<keyof Data, never>>, secret: Jsonify<Data>) {
    const result: Partial<Jsonify<Data>> = {};
    const keys: (keyof Jsonify<Data>)[] = this.keys ?? (Object.keys(secret) as any);

    for (const key of keys) {
      result[key] = secret[key];
    }

    return result as Jsonify<Data>;
  }
}
