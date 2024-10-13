import { MPD } from "./mpd.ts";
import { parseUnknownList } from "./transformers.ts";
import { connect } from "./utils.ts";
import type { TCPConnection } from "./utils.ts";

const getPort = (port?: number | string): number | null => {
  if (typeof port === "string") {
    return parseInt(port, 10);
  }
  return port || null;
};
const getHost = (host?: string): string | null => {
  return host || null;
};

export class MPDClient {
  mpd: MPD;
  info: string = "";
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
    const _host = getHost(hostname || Deno.env.get("MPD_HOST"));
    const _port = getPort(port || Deno.env.get("MPD_PORT"));
    if (!_host || !_port) {
      throw new Error("No host or port provided");
    }
    const connection = await connectFn(_host, _port);
    return new MPDClient(new MPD(connection));
  }

  /**
   * Pause or resume playback. Pass true to pause playback or false to resume playback. W ithout the parameter, the pause state is toggled.
   * @param pause Pause if true, unpause if false, otherwise toggle
   * @returns
   */
  async pause(pause?: boolean): Promise<string> {
    const mes = pause === undefined ? "pause" : `pause ${pause ? 1 : 0}`;
    return await this.mpd.sendMessage(mes);
  }

  async queue(): Promise<Record<string, string>[]> {
    const playlistInfo = await this.mpd.sendMessage("playlistinfo");
    return parseUnknownList(playlistInfo);
  }

  async clearQueue(): Promise<void> {
    await this.mpd.sendMessage("clear");
  }

  async addToQueue(uri: string): Promise<void> {
    await this.mpd.sendMessage(`add "${uri}"`);
  }

  async addAlbumToQueue(album: string): Promise<void> {
    await this.mpd.sendMessage(`findadd album "${album}"`);
  }

  disconnect(): void {
    if (this.mpd.conn) {
      this.mpd.conn.close();
      this.mpd.conn = null;
    }
  }
}
