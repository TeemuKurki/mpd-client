import { concat, endsWith, includesNeedle } from "@std/bytes";
import { assertExists } from "@std/assert";

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
  connect: () => Promise<void>;
}

const MSG_END_BIN = [
  new TextEncoder().encode("OK\n"),
  new TextEncoder().encode("ACK "),
];

const getResponse = async (conn: Deno.TcpConn) => {
  let data = new Uint8Array();
  const buf = new Uint8Array(128);
  while (true) {
    const bytesRead = await conn.read(buf);
    if (bytesRead === null) {
      throw new Error("Connection closed by server");
    }
    const content = buf.subarray(0, bytesRead);
    data = concat([data, content]);
    const OK_RESPONSE = endsWith(content, MSG_END_BIN[0]);
    if (OK_RESPONSE) {
      break;
    }
    const ACK_RESPONSE = includesNeedle(content, MSG_END_BIN[1]);
    if (ACK_RESPONSE) {
      break;
    }
  }
  return data;
};

export class TCPClient implements TCPConnection {
  #host: string;
  #port: number;
  #connection: Deno.TcpConn | null;
  constructor(host: string, port: number) {
    this.#host = host;
    this.#port = port;
    this.#connection = null;
  }

  async connect(): Promise<void> {
    this.#connection = await Deno.connect({
      hostname: this.#host,
      port: this.#port,
    });
  }

  close(): void {
    console.debug("Close a connection");
    if (this.#connection) {
      this.#connection.close();
      this.#connection = null;
    }
  }

  read(buffer: Uint8Array): Promise<number | null> {
    assertExists(this.#connection, "No open connections");
    return this.#connection.read(buffer);
  }
  async readAll(): Promise<string>;
  async readAll(getInBinary: true): Promise<Uint8Array>;
  async readAll(getInBinary?: boolean): Promise<string | Uint8Array> {
    assertExists(this.#connection, "No open connections");
    const data = await getResponse(this.#connection);
    if (getInBinary) {
      return data;
    }
    return new TextDecoder().decode(data);
  }
  write(data: Uint8Array): Promise<number> {
    assertExists(this.#connection, "No open connections");
    return this.#connection.write(data);
  }
}
