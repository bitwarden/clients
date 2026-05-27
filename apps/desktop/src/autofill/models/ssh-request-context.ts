export type HostSource = "none" | "argv" | "known-hosts" | "host-key";

export interface ProcessFrame {
  pid: number;
  name: string;
  executablePath: string | null;
}

export interface AppContext {
  processName: string;
  executablePath: string | null;
  pid: number;
  parentChain: ProcessFrame[];
  argv: string[] | null;
}

export interface HostContext {
  source: HostSource;
  hostname: string | null;
  hostnameUnverified: string | null;
  port: number | null;
  username: string | null;
  keyFingerprint: string | null;
  knownHostsMatch: boolean;
}

export interface RequestContext {
  app: AppContext;
  host: HostContext;
}
