export interface PhishingManifest {
  version: number;
  full_list: {
    path: string;
    sha256: string;
    sorted_sha256: string;
    line_count: number;
  };
  patches: PhishingPatch[];
}

export interface PhishingPatch {
  date: string;
  path: string;
  from_sha256: string;
  to_sha256: string;
}
