import { MPD } from "./mpd.ts";
import { createFilter, getHost, getPort } from "./utils.ts";
import type { Filter, TCPConnection } from "./utils.ts";

export class MPDClient {
  mpd: MPD;
  constructor(mpd: MPD) {
    this.mpd = mpd;
  }

  //TODO: implement timeout and host/port from environment variables. https://mpd.readthedocs.io/en/latest/client.html#environment-variables
  //TODO: Refactor host and port to be passed in as an object
  static async connect(
    connectFn: (hostname: string, port: number) => Promise<TCPConnection>,
    hostname?: string,
    port?: number,
  ): Promise<MPDClient> {
    const _host = getHost(hostname);
    const _port = getPort(port);
    if (!_host || !_port) {
      throw new Error("No host or port provided");
    }
    const connection = await connectFn(_host, _port);
    const idleConnection = await connectFn(_host, _port);
    return new MPDClient(new MPD(connection, idleConnection));
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
    return this.mpd.playlistinfo();
  }

  async clearQueue(): Promise<void> {
    await this.mpd.sendMessage("clear");
  }
  async clearRestOfQueue() {
    const currentSong = await this.currentSong();
    const currentPosition = currentSong?.Pos;
    if (currentPosition) {
      const playlist = await this.mpd.playlist();
      const delStart = Number.parseInt(currentPosition) + 1;
      this.mpd.sendMessage(`delete ${delStart}:${playlist.length}`);
    }
  }

  /**
   * Add songs to the queue based on provided filter or uri. If both are provided, uri will be used.
   */
  async addToQueue(params: {
    filter?: Filter | Filter[] | string;
    uri?: string;
  }): Promise<void> {
    if (params.uri) {
      await this.mpd.sendMessage(`add "${params.uri}"`);
    } else if (params.filter) {
      await this.mpd.sendMessage(`findadd ${createFilter(params.filter)}`);
    }
  }

  /**
   * Add an album to the queue
   */
  async addAlbumToQueue(album: string, artist?: string): Promise<void> {
    const filterParams: Filter[] = [{ tag: "album", value: album }];
    if (artist) {
      filterParams.push({ tag: "artist", value: artist });
    }
    const filter = createFilter(filterParams);
    await this.mpd.sendMessage(`findadd ${filter}`);
  }

  async listArtists() {
    const res = await this.mpd.list({
      type: "albumartist",
    });
    return res.map((artist) => artist.AlbumArtist).filter(Boolean);
  }
  async listAlbums(artist?: string) {
    const filter: Filter | undefined = artist
      ? {
        tag: "albumartist",
        value: artist,
      }
      : undefined;
    const res = await this.mpd.list({
      type: "album",
      group: "albumartist",
      filter: filter,
    });
    return res;
  }

  async getTracks(album: string) {
    const filter: Filter = {
      tag: "album",
      value: album,
    };
    const res = await this.mpd.find({
      filter: filter,
    });
    return res;
  }

  async info() {
    return {
      currentSong: await this.mpd.currentSong(),
      status: await this.mpd.status(),
      stats: await this.mpd.stats(),
    };
  }

  currentSong(): Promise<Record<string, string>> {
    return this.mpd.currentSong();
  }

  disconnect(): void {
    this.mpd.disconnect();
  }
}
