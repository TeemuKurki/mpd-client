import type { AnyFilter } from "./types.ts";
import { indexOfNeedle } from "@std/bytes";
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
  connect: () => Promise<void>;
}

type Falsy = false | undefined;

export const createFilter = (filter?: AnyFilter): string => {
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

export function handleBinaryResponse(
  response: Uint8Array,
): {
  binary: Uint8Array;
  headers: {
    size: number;
    type?: string;
    binarySize: number;
  };
} {
  const binaryMatch = indexOfNeedle(
    response,
    new TextEncoder().encode("binary: "),
  );
  const headerEndIndex = indexOfNeedle(
    response,
    new Uint8Array([10]), //\n
    binaryMatch,
  );
  if (binaryMatch === -1) {
    throw new Error("Invalid response format: no binary header section.");
  }

  if (headerEndIndex === -1) {
    throw new Error("Invalid response format: no header section.");
  }
  const binaryStartIndex = headerEndIndex + 1;

  const decoder = new TextDecoder();
  const headersText = decoder.decode(response.slice(0, binaryStartIndex));
  const headers = parseHeaders(headersText);

  const size = parseInt(headers["binary"] || headers["size"] || "0", 10);

  if (isNaN(size)) throw new Error("Invalid binary size in response.");
  // Extract binary data
  const binaryData = response.slice(
    binaryStartIndex,
    binaryStartIndex + size,
  );

  return {
    binary: binaryData,
    headers: {
      binarySize: size,
      size: parseInt(headers["size"], 10),
      type: headers["type"],
    },
  };
}

function parseHeaders(headerText: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of headerText.split("\n")) {
    const [key, ...valueParts] = line.split(": ");
    if (key && valueParts.length > 0) {
      headers[key.trim()] = valueParts.join(": ").trim();
    }
  }
  return headers;
}
