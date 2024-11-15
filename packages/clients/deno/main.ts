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

  close(): void {
    console.debug("Close a connection");
    this.#connection.close();
  }

  read(buffer: Uint8Array): Promise<number | null> {
    assertExists(this.#connection);
    return this.#connection.read(buffer);
  }
  async readAll(): Promise<string>;
  async readAll(getInBinary: true): Promise<Uint8Array>;
  async readAll(getInBinary?: boolean): Promise<string | Uint8Array> {
    assertExists(this.#connection);
    const data = await getResponse(this.#connection);
    if (getInBinary) {
      return data;
    }
    return new TextDecoder().decode(data);
  }
  write(data: Uint8Array): Promise<number> {
    assertExists(this.#connection);
    return this.#connection.write(data);
  }
}
