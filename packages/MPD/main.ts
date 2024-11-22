import { MPD } from "./mpd.ts";
import {
  parse,
  parseUnknown,
  parseUnknownGroup,
  parseUnknownList,
  type ResolvedTransformer,
  StatsTransform,
  StatusTransform,
} from "./transformers.ts";
import type { AnyFilter, Filter, MPDClientInterface, Tag } from "./types.ts";
import { createFilter } from "./utils.ts";
import type { TCPConnection } from "./utils.ts";

export interface TCPClient<T = TCPConnection> {
  new (connetion: any): T;
  connect(hostname: string, port: number): Promise<T>;
}

export class MPDClient implements MPDClientInterface {
  mpd: MPD;
  constructor(mpd: MPD) {
    this.mpd = mpd;
  }

  //TODO: implement timeout and host/port from environment variables. https://mpd.readthedocs.io/en/latest/client.html#environment-variables
  static init(
    connectionClass: TCPClient,
    hostname: string,
    port: number,
  ): MPDClient {
    return new MPDClient(new MPD(connectionClass, hostname, port));
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

  async getTracks(
    album: string,
    limit?: number,
  ): Promise<Record<string, string>[]> {
    const opts = limit !== undefined
      ? {
        window: [0, limit] as [number, number],
      }
      : undefined;
    const res = await this.mpd.find({
      tag: "album",
      value: album,
    });
    return parseUnknownList(res);
  }

  async status(): Promise<ResolvedTransformer<typeof StatusTransform>> {
    const status = await this.mpd.status();
    return parse(status, StatusTransform);
  }
  async stats(): Promise<ResolvedTransformer<typeof StatsTransform>> {
    const status = await this.mpd.stats();
    return parse(status, StatsTransform);
  }

  async info(): Promise<{
    currentSong: Record<string, string>;
    status: ResolvedTransformer<typeof StatusTransform>;
    stats: ResolvedTransformer<typeof StatsTransform>;
  }> {
    return {
      currentSong: await this.currentSong(),
      status: await this.status(),
      stats: await this.stats(),
    };
  }

  async list(type: Tag, options: {
    filter?: AnyFilter;
    group: Tag;
  }): Promise<{
    group: string;
    values: string[];
  }[]>;
  async list(type: Tag, options?: {
    filter?: AnyFilter;
    group?: undefined;
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
}
