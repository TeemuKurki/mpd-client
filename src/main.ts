import { MPDProtocol } from "./mpd.ts";
import {
  parse,
  parseList,
  parseUnknownGroup,
  parseUnknownList,
  StatsTransform,
  StatusTransform,
  TrackTransform,
} from "./transformers.ts";
import type { AnyFilter, Filter, ResolvedTransformer, Tag } from "./types.ts";
import { createFilter } from "./utils.ts";
import type { TCPConnection } from "./utils.ts";

/**
 * TCP client interface
 */
export interface TCPClient<T = TCPConnection> {
  /**
   * TCP connection parameters
   * @param hostname MPD server host
   * @param port MPD server port
   */
  connect(hostname: string, port: number): Promise<T>;
}

/**
 * MPD Client
 */
export class MPDClient {
  /** MPD Protocol instance */
  public mpd: MPDProtocol;
  /**
   * Create MPD Client
   * @param mpd MPD Protocol class instance
   */
  constructor(mpd: MPDProtocol) {
    this.mpd = mpd;
  }

  //TODO: implement timeout and host/port from environment variables. https://mpd.readthedocs.io/en/latest/client.html#environment-variables
  /**
   * Initialize MPDClient with a provided TCPClient
   * @param connectionClass TCPClient class
   * @param hostname MPD server host
   * @param port MPD server port
   * @returns new MPDClient with provided TCPClient
   */
  static init(
    connectionClass: TCPClient,
    hostname: string,
    port: number,
  ): MPDClient {
    return new MPDClient(new MPDProtocol(connectionClass, hostname, port));
  }

  /**
   * Returns infromation of all tracks in the current queue
   */
  async queue(): Promise<Record<string, unknown>[]> {
    const response = await this.mpd.playlistInfo();
    return parseList(response, TrackTransform, "file");
  }

  /**
   * Clears current queue
   */
  async clearQueue(): Promise<void> {
    await this.mpd.clear();
  }

  /**
   * Clears the current queue from current song position onwards
   */
  async clearRestOfQueue(): Promise<void> {
    const currentSong = await this.currentSong();
    const currentPosition = currentSong?.Pos;
    if (currentPosition) {
      const playlist = await this.mpd.playlistInfo();
      const delStart = currentPosition + 1;
      await this.mpd.delete([delStart, playlist.length]);
    }
  }

  /**
   * Add songs to the queue based on provided filter or uri. If both are provided, uri will be used.
   */
  async addToQueue(params: {
    filter?: AnyFilter;
    uri?: string;
  }): Promise<number> {
    const currentQueue = await this.queue();
    const lastTrack = currentQueue.at(-1);
    if (params.uri) {
      await this.mpd.add(params.uri);
    } else if (params.filter) {
      await this.mpd.findAdd(params.filter);
    }
    if (!lastTrack) {
      return 0;
    }
    return Number.parseInt(lastTrack.Pos as string, 10) + 1;
  }
  /**
   * Add all tracks from an album to the queue
   */
  async addAlbumToQueue(
    album: string,
    artist?: string,
    artistTag: Tag = "albumartist",
  ): Promise<{
    albumPos: number;
  }> {
    const filterParams: Filter[] = [{ tag: "album", value: album }];
    if (artist) {
      filterParams.push({ tag: artistTag, value: artist });
    }
    const filter = createFilter(filterParams);
    const currentQueue = await this.queue();
    const lastTrack = currentQueue.at(-1);
    await this.mpd.findAdd(filter);
    if (!lastTrack || !lastTrack.Pos) {
      return {
        albumPos: 0,
      };
    }
    return {
      albumPos: Number.parseInt(lastTrack.Pos as string, 10) + 1,
    };
  }
  /**
   * Starts playback. If no `pos` play from current song
   * @param pos Start playback from position in queue
   */
  async play(pos?: number): Promise<void> {
    if (pos === undefined) {
      await this.mpd.pause();
    } else {
      await this.mpd.play(pos);
    }
  }
  /**
   * Lists all artists.
   * @param  artistTag Find artists based on Tag. Defaults to "albumartist"
   */
  async listArtists(artistTag: Tag = "albumartist"): Promise<string[]> {
    const response = await this.mpd.list(artistTag);
    const res = parseUnknownList(response, artistTag);
    return res.map((artist) => artist.AlbumArtist as string).filter(Boolean);
  }
  /**
   * List all albums from artist
   * @param artist Name of the artist
   * @param artistTag Find artists based on Tag. Defaults to "albumartist"
   */
  async listAlbums(
    artist?: string,
    artistTag: Tag = "albumartist",
  ): Promise<{ group: string; values: string[] }[]> {
    const filter: Filter | undefined = artist
      ? {
        tag: artistTag,
        value: artist,
      }
      : undefined;
    const result = await this.mpd.list("album", {
      group: artistTag,
      filter: filter,
    });
    return parseUnknownGroup(result, artistTag);
  }
  /**
   * List tracks from album
   * @param album Name of the album
   * @param artist Name of the artist
   * @param limit Limit of returned tracks
   * @param artistTag Find artists based on Tag. Defaults to "albumartist"
   */
  async listTracks(
    album: string,
    artist?: string,
    limit?: number,
    artistTag: Tag = "albumartist",
  ): Promise<ResolvedTransformer<typeof TrackTransform>[]> {
    const opts = limit !== undefined
      ? {
        window: [0, limit] as [number, number],
      }
      : undefined;
    const filter: AnyFilter = [{
      tag: "album",
      value: album,
    }];

    if (artist) {
      filter.push({
        tag: artistTag,
        value: artist,
      });
    }
    const result = await this.mpd.find(filter, opts);
    return parseList(result, TrackTransform, "file", true);
  }
  /**
   * Displays the current status of the player.
   */
  async status(): Promise<ResolvedTransformer<typeof StatusTransform>> {
    const status = await this.mpd.status();
    return parse(status, StatusTransform);
  }
  /**
   * Shows statistics about the database.
   */
  async stats(): Promise<ResolvedTransformer<typeof StatsTransform>> {
    const status = await this.mpd.stats();
    return parse(status, StatsTransform);
  }
  /**
   * Lists all information based on type and options. TYPE can be any tag supported by MPD.
   * @param type Tag supported by MPD
   * @param options Options for filtering and grouping tag values
   */
  async list(type: Tag, options: {
    filter?: AnyFilter;
    group: Tag;
  }): Promise<{
    group: string;
    values: string[];
  }[]>;
  /**
   * Lists all information based on type and options. TYPE can be any tag supported by MPD.
   * @param type Tag supported by MPD
   * @param options
   */
  async list(type: Tag, options?: {
    filter?: AnyFilter;
    group?: undefined;
  }): Promise<Record<string, unknown>[]>;
  async list(type: Tag, options?: {
    filter?: AnyFilter;
    group?: Tag;
  }): Promise<
    Record<string, unknown>[] | { group: string; values: string[] }[]
  > {
    const response = await this.mpd.list(type, options);
    if (options?.group) {
      return parseUnknownGroup(response, options.group);
    }
    return parseUnknownList(response, type);
  }
  /**
   * Displays the current song in the playlist.
   */
  async currentSong(): Promise<
    ResolvedTransformer<typeof TrackTransform>
  > {
    const response = await this.mpd.currentSong();
    return parse(response, TrackTransform);
  }

  /**
   * Play next song in queue
   */
  async next(): Promise<void> {
    await this.mpd.next();
  }
  /**
   * Play previous song in queue
   */
  async previous(): Promise<void> {
    await this.mpd.previous();
  }
}
