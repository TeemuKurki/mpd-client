import { concat, endsWith, includesNeedle } from "@std/bytes";

type Falsy = false | undefined;

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


const MSG_END_BIN = [
    new TextEncoder().encode("OK\n"),
    new TextEncoder().encode("ACK "),
  ];

export const TCPClient = async (
    hostname: string,
    port: number,
  ): Promise<TCPConnection> => {
    const connection = await Deno.connect({
      hostname,
      port,
    });
  
    async function readAll(): Promise<string>;
    async function readAll(getInBinary: true): Promise<Uint8Array>;
    async function readAll(getInBinary?: boolean): Promise<string | Uint8Array> {
      const reader = connection.readable.getReader();
      const data = await getResponse(reader);
      if (getInBinary) {
        return data;
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
  

  const getResponse = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ) => {
    let data = new Uint8Array();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        data = concat([data, value]);
        const OK_RESPONSE = endsWith(value, MSG_END_BIN[0]);
        if (OK_RESPONSE) {
          break;
        }
        const ACK_RESPONSE = includesNeedle(value, MSG_END_BIN[1]);
        if (ACK_RESPONSE) {
          break;
        }
      }
      return data;
    } catch (e: any) {
      throw new Error("Error reading stream", e);
    } finally {
      reader.releaseLock();
    }
  };
  