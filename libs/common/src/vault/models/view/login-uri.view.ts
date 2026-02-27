import { Jsonify } from "type-fest";

import { LoginUriView as SdkLoginUriView } from "@bitwarden/sdk-internal";

import { UriMatchStrategy, UriMatchStrategySetting } from "../../../models/domain/domain-service";
import { View } from "../../../models/view/view";
import { SafeUrls } from "../../../platform/misc/safe-urls";
import { Utils } from "../../../platform/misc/utils";
import { LoginUri } from "../domain/login-uri";

export class LoginUriView implements View {
  match?: UriMatchStrategySetting;

  private _uri?: string;
  private _domain?: string;
  private _hostname?: string;
  private _host?: string;
  private _canLaunch?: boolean;

  constructor(u?: LoginUri) {
    if (!u) {
      return;
    }

    this.match = u.match;
  }

  get uri(): string | undefined {
    return this._uri;
  }
  set uri(value: string | undefined) {
    this._uri = value;
    this._domain = undefined;
    this._canLaunch = undefined;
  }

  get domain(): string | undefined {
    if (this._domain == null && this.uri != null) {
      this._domain = Utils.getDomain(this.uri);
      if (this._domain === "") {
        this._domain = undefined;
      }
    }

    return this._domain;
  }

  get hostname(): string | undefined {
    if (this.match === UriMatchStrategy.RegularExpression) {
      return undefined;
    }
    if (this._hostname == null && this.uri != null) {
      this._hostname = Utils.getHostname(this.uri);
      if (this._hostname === "") {
        this._hostname = undefined;
      }
    }

    return this._hostname;
  }

  get host(): string | undefined {
    if (this.match === UriMatchStrategy.RegularExpression) {
      return undefined;
    }
    if (this._host == null && this.uri != null) {
      this._host = Utils.getHost(this.uri);
      if (this._host === "") {
        this._host = undefined;
      }
    }

    return this._host;
  }

  get hostnameOrUri(): string | undefined {
    return this.hostname != null ? this.hostname : this.uri;
  }

  get hostOrUri(): string | undefined {
    return this.host != null ? this.host : this.uri;
  }

  get isWebsite(): boolean {
    return (
      this.uri != null &&
      (this.uri.indexOf("http://") === 0 ||
        this.uri.indexOf("https://") === 0 ||
        (this.uri.indexOf("://") < 0 && !Utils.isNullOrWhitespace(Utils.getDomain(this.uri))))
    );
  }

  get canLaunch(): boolean {
    if (this._canLaunch != null) {
      return this._canLaunch;
    }
    if (this.uri != null && this.match !== UriMatchStrategy.RegularExpression) {
      this._canLaunch = SafeUrls.canLaunch(this.launchUri);
    } else {
      this._canLaunch = false;
    }
    return this._canLaunch;
  }

  get launchUri(): string | undefined {
    if (this.uri == null) {
      return undefined;
    }
    return this.uri.indexOf("://") < 0 && !Utils.isNullOrWhitespace(Utils.getDomain(this.uri))
      ? "http://" + this.uri
      : this.uri;
  }

  static fromJSON(obj: Partial<Jsonify<LoginUriView>>): LoginUriView {
    return Object.assign(new LoginUriView(), obj);
  }

  /**
   * Converts a LoginUriView object from the SDK to a LoginUriView object.
   */
  static fromSdkLoginUriView(obj: SdkLoginUriView): LoginUriView | undefined {
    if (obj == null) {
      return undefined;
    }

    const view = new LoginUriView();
    view.uri = obj.uri;
    view.match = obj.match;

    return view;
  }

  /** Converts a LoginUriView object to an SDK LoginUriView object. */
  toSdkLoginUriView(): SdkLoginUriView {
    return {
      uri: this.uri ?? undefined,
      match: this.match ?? undefined,
      uriChecksum: undefined, // SDK handles uri checksum generation internally
    };
  }

  matchesUri(
    targetUri: string,
    equivalentDomains: Set<string>,
    defaultUriMatch?: UriMatchStrategySetting,
    /** When present, will override the match strategy for the cipher if it is `Never` with `Domain` */
    overrideNeverMatchStrategy?: true,
  ): boolean {
    if (!this.uri || !targetUri) {
      return false;
    }

    let matchType = this.match ?? defaultUriMatch;
    matchType ??= UriMatchStrategy.Domain;

    // Override the match strategy with `Domain` when it is `Never` and `overrideNeverMatchStrategy` is true.
    // This is useful in scenarios when the cipher should be matched to rely other information other than autofill.
    if (overrideNeverMatchStrategy && matchType === UriMatchStrategy.Never) {
      matchType = UriMatchStrategy.Domain;
    }

    const targetDomain = Utils.getDomain(targetUri);
    const matchDomains = equivalentDomains.add(targetDomain);

    switch (matchType) {
      case UriMatchStrategy.Domain:
        return this.matchesDomain(targetUri, matchDomains);
      case UriMatchStrategy.Host: {
        const urlHost = Utils.getHost(targetUri);
        return urlHost != null && urlHost === Utils.getHost(this.uri);
      }
      case UriMatchStrategy.Exact:
        return targetUri === this.uri;
      case UriMatchStrategy.StartsWith:
        return targetUri.startsWith(this.uri);
      case UriMatchStrategy.RegularExpression:
        try {
          const regex = new RegExp(this.uri, "i");
          return regex.test(targetUri);
          // FIXME: Remove when updating file. Eslint update
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          // Invalid regex
          return false;
        }
      case UriMatchStrategy.Never:
        return false;
      default:
        break;
    }

    return false;
  }

  private matchesDomain(targetUri: string, matchDomains: Set<string>) {
    if (targetUri == null || this.domain == null || !matchDomains.has(this.domain)) {
      return false;
    }

    if (Utils.DomainMatchBlacklist.has(this.domain)) {
      const domainUrlHost = Utils.getHost(targetUri);
      return !Utils.DomainMatchBlacklist.get(this.domain)!.has(domainUrlHost);
    }

    return true;
  }
}
