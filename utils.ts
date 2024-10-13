const MSG_END = [/^OK$/, /^ACK /];

export const readMessageStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>
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
  port: number
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
