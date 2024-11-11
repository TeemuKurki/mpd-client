import type { Tag } from "./mpd.ts";
import {concat, endsWith, includesNeedle} from "@std/bytes"

const MSG_END_BIN = [
  new TextEncoder().encode("\nOK\n"),
  new TextEncoder().encode("ACK ")
]

const getResponse = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
) => {
  let data = new Uint8Array();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      data = concat([data, value])
      const OK_RESPONSE = endsWith(value, MSG_END_BIN[0])
      if(OK_RESPONSE) {
        break
      }
      const ACK_RESPONSE = includesNeedle(value, MSG_END_BIN[1])
      if(ACK_RESPONSE) {
        break
      }
    }
    return data
  } catch (e: any) {
    throw new Error("Error reading stream", e);
  } finally {
    reader.releaseLock();
  }
};

export interface TCPConnection {
  read: (buffer: Uint8Array) => Promise<number | null>;
  readAll: {
    (): Promise<string>;
    (getInBinary: Falsy): Promise<string>;
    (getInBinary: true): Promise<Uint8Array>;
    (getInBinary?: boolean): Promise<string | Uint8Array>;
  }
  close: () => void;
  write: (data: Uint8Array) => Promise<number>;
};


type Falsy = false | undefined

export const connect = async (
  hostname: string,
  port: number,
): Promise<TCPConnection> => {
  const connection = await Deno.connect({
    hostname,
    port,
  });

  
  async function readAll(): Promise<string>
  async function readAll(getInBinary: true): Promise<Uint8Array>
  async function readAll(getInBinary?: boolean): Promise<string | Uint8Array> {
    const reader = connection.readable.getReader();
      const data = await getResponse(reader);
      if(getInBinary) {
        return data
      }
      return new TextDecoder().decode(data);
  }

  return {
    read: (buffer: Uint8Array) => connection.read(buffer),
    readAll: readAll,
    close: () => connection.close(),
    write: (data: Uint8Array) => connection.write(data),
  };
};

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
