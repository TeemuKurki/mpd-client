import { MPD } from "./mpd.ts";
import {
  parseUnknown,
  parseUnknownGroup,
  parseUnknownList,
} from "./transformers.ts";
import type {
  AnyFilter,
  Filter,
  MPDClientInterface,
  MPDProtocol,
  Tag,
} from "./types.ts";
import { createFilter, getHost, getPort } from "./utils.ts";
import type { TCPConnection } from "./utils.ts";

export class MPDClient implements MPDClientInterface {
  mpd: MPDProtocol;
  constructor(mpd: MPDProtocol) {
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

  async queue(): Promise<Record<string, string>[]> {
    const response = await this.mpd.playlistInfo();
    return parseUnknownList(response, "file");
  }

  async clearQueue(): Promise<void> {
    await this.mpd.clear();
  }
  async clearRestOfQueue(): Promise<void> {
    const currentSong = await this.currentSong();
    const currentPosition = currentSong?.Pos;
    if (currentPosition) {
      const playlist = await this.mpd.playlistInfo();
      const delStart = Number.parseInt(currentPosition) + 1;
      await this.mpd.delete([delStart, playlist.length]);
    }
  }

  /**
   * Add songs to the queue based on provided filter or uri. If both are provided, uri will be used.
   */
  async addToQueue(params: {
    filter?: AnyFilter;
    uri?: string;
  }): Promise<void> {
    if (params.uri) {
      await this.mpd.add(params.uri);
    } else if (params.filter) {
      await this.mpd.findAdd(params.filter);
    }
  }

  /**
   * Add an album to the queue
   */
  async addAlbumToQueue(album: string, artist?: string): Promise<string> {
    const filterParams: Filter[] = [{ tag: "album", value: album }];
    if (artist) {
      filterParams.push({ tag: "artist", value: artist });
    }
    const filter = createFilter(filterParams);
    return await this.mpd.findAdd(filter);
  }

  async listArtists(): Promise<string[]> {
    const response = await this.mpd.list("albumartist");
    const res = parseUnknownList(response, "albumartist");
    return res.map((artist) => artist.AlbumArtist).filter(Boolean);
  }
  async listAlbums(
    artist?: string,
  ): Promise<{ group: string; values: string[] }[]> {
    const filter: Filter | undefined = artist
      ? {
        tag: "albumartist",
        value: artist,
      }
      : undefined;
    const result = await this.mpd.list("album", {
      group: "albumartist",
      filter: filter,
    });
    return parseUnknownGroup(result, "albumartist");
  }

  async getTracks(album: string): Promise<Record<string, string>[]> {
    const res = await this.mpd.find({
      tag: "album",
      value: album,
    });
    return parseUnknownList(res);
  }

  async status(): Promise<Record<string, string>> {
    const status = await this.mpd.status();
    return parseUnknown(status);
  }
  async stats(): Promise<Record<string, string>> {
    const status = await this.mpd.stats();
    return parseUnknown(status);
  }

  async info(): Promise<{
    currentSong: Record<string, string>;
    status: Record<string, string>;
    stats: Record<string, string>;
  }> {
    return {
      currentSong: await this.currentSong(),
      status: await this.status(),
      stats: await this.stats(),
    };
  }

  async list(type: Tag, options?: {
    filter?: AnyFilter;
    group: Tag;
  }): Promise<{
    group: string;
    values: string[];
  }[]>;
  async list(type: Tag, options?: {
    filter?: AnyFilter;
  }): Promise<Record<string, string>[]>;
  async list(type: Tag, options?: {
    filter?: AnyFilter;
    group?: Tag;
  }): Promise<
    Record<string, string>[] | { group: string; values: string[] }[]
  > {
    const response = await this.mpd.list(type, options);
    if (options?.group) {
      return parseUnknownGroup(response, options.group);
    }
    return parseUnknownList(response, type);
  }

  async currentSong(): Promise<Record<string, string>> {
    const response = await this.mpd.currentSong();
    return parseUnknown(response);
  }

  disconnect(): void {
    this.mpd.close();
  }
}
