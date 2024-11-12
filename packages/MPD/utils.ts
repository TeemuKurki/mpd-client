import type { Tag } from "./mpd.ts";

export interface TCPConnection {
  read: (buffer: Uint8Array) => Promise<number | null>;
  readAll: {
    (): Promise<string>;
    (getInBinary: Falsy): Promise<string>;
    (getInBinary: true): Promise<Uint8Array>;
    (getInBinary?: boolean): Promise<string | Uint8Array>;
  };
  close: () => void;
  write: (data: Uint8Array) => Promise<number>;
}

type Falsy = false | undefined;

type FilterCompareMethod =
  | "=="
  | "!="
  | "contains"
  | "!contains"
  | "starts_with"
  | "=~"
  | "!~";

//TODO: Enable non-tag based filters (ie. audioFormat, prio etc)
//TODO: Enable negate option
export type Filter = {
  tag: Tag;
  value: string;
  /**
   * @param {string} [compare="=="] Filter compare expression method. See possible methods {@link https://mpd.readthedocs.io/en/latest/protocol.html#filters}
   */
  compare?: FilterCompareMethod;
};

export const createFilter = (filter?: Filter | Filter[] | string): string => {
  const handleQuotes = (value: string, single?: boolean) => {
    const quot = single ? "'" : '"';
    if (!value.startsWith(quot) && !value.endsWith(quot)) {
      return `${quot}${value}${quot}`;
    }
    return value;
  };
  if (!filter) {
    return "";
  }
  if (typeof filter === "string") {
    return handleQuotes(filter);
  }
  if (Array.isArray(filter)) {
    return filter.map(createFilter).join(" ");
  }
  const comp = filter?.compare || "==";
  return handleQuotes(
    `(${filter.tag} ${comp} ${handleQuotes(filter.value, true)})`,
  );
};

export const getHost = (host?: string): string => {
  if (host) {
    return host;
  }
  let _host = "";
  if (navigator.userAgent.startsWith("Deno")) {
    _host = Deno.env.get("MPD_HOST") || "";
  } else if (navigator.userAgent.startsWith("Node")) {
    //@ts-ignore For Node support
    // deno-lint-ignore no-process-globals
    _host = process.env.MPD_HOST;
  }
  return _host;
};
export const getPort = (port?: number): number => {
  if (port) {
    return port;
  }
  let _port = "";
  if (navigator.userAgent.startsWith("Deno")) {
    _port = Deno.env.get("MPD_PORT") || "";
  } else if (navigator.userAgent.startsWith("Node")) {
    //@ts-ignore For Node support
    // deno-lint-ignore no-process-globals
    _port = process.env.MPD_PORT;
  }
  return Number.parseInt(_port);
};

console.log(getHost());
