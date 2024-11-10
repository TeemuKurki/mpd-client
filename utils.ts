import type { Tag } from "./mpd.ts";

const MSG_END = [/^OK$/, /^ACK /];

export const readMessageStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
) => {
  const chunks: string[] = [];
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const res = decoder.decode(value);
      chunks.push(res);
      const lastLine = res.split("\n").at(-2);
      if (
        !lastLine ||
        MSG_END.some((closeRegex) => closeRegex.test(lastLine))
      ) {
        break;
      }
    }
    return chunks.join("");
  } catch (e: any) {
    throw new Error("Error reading stream", e);
  } finally {
    reader.releaseLock();
  }
};

export type TCPConnection = {
  read: (buffer: Uint8Array) => Promise<number | null>;
  readAll: () => Promise<string>;
  close: () => void;
  write: (data: Uint8Array) => Promise<number>;
};

export const connect = async (
  hostname: string,
  port: number,
): Promise<TCPConnection> => {
  const connection = await Deno.connect({
    hostname,
    port,
  });
  return {
    read: (buffer: Uint8Array) => connection.read(buffer),
    readAll: () => {
      const reader = connection.readable.getReader();
      return readMessageStream(reader);
    },
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
