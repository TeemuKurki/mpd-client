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

export class TCPClient implements TCPConnection {
  #connection: Deno.TcpConn;
  private constructor(connection: Deno.TcpConn) {
    this.#connection = connection;
  }

  static async connect(hostname: string, port: number) {
    const conn = await Deno.connect({
      hostname,
      port,
    });
    return new TCPClient(conn);
  }

  read(buffer: Uint8Array): Promise<number | null> {
    return this.#connection.read(buffer);
  }
  async readAll(): Promise<string>;
  async readAll(getInBinary: true): Promise<Uint8Array>;
  async readAll(getInBinary?: boolean): Promise<string | Uint8Array> {
    const reader = this.#connection.readable.getReader();
    const data = await getResponse(reader);
    if (getInBinary) {
      return data;
    }
    return new TextDecoder().decode(data);
  }
  write(data: Uint8Array): Promise<number> {
    return this.#connection.write(data);
  }
  close(): void {
    this.#connection.close();
  }
}
