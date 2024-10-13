import { MPD } from "./mpd.ts";
import { connect } from "./utils.ts";
import type { TCPConnection } from "./utils.ts";

export class MPDClient {
  mpd: MPD;
  constructor(mpd: MPD) {
    this.mpd = mpd;
  }

  //TODO: implement timeout and host/port from environment variables. https://mpd.readthedocs.io/en/latest/client.html#environment-variables
  //TODO: Refactor host and port to be passed in as an object
  static async connect(
    hostname?: string,
    port?: number,
    connectFn: (
      hostname: string,
      port: number
    ) => Promise<TCPConnection> = connect
  ): Promise<MPDClient> {
    const _host = hostname || Deno.env.get("MPD_HOST");
    const _port = Deno.env.get("MPD_PORT");
    if (!_host || !_port) {
      throw new Error("No host or port provided");
    }
    const connection = await connectFn(_host, port || parseInt(_port, 10));
    return new MPDClient(new MPD(connection));
  }

  /**
   * Pause or resume playback. Pass true to pause playback or false to resume playback. Without the parameter, the pause state is toggled.
   * @param pause Pause if true, unpause if false, otherwise toggle
   * @returns
   */
  async pause(pause?: boolean): Promise<string> {
    const mes = pause === undefined ? "pause" : `pause ${pause ? 1 : 0}`;
    return await this.mpd.sendMessage(mes);
  }

  disconnect(): void {
    if (this.mpd.conn) {
      this.mpd.conn.close();
      this.mpd.conn = null;
    }
  }
}
