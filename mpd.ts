import { assert } from "@std/assert";
import { createFilter, type Filter, type TCPConnection } from "./utils.ts";
import {
  parse,
  parseUnknown,
  parseUnknownGroup,
  parseUnknownList,
  StatsTransform,
  StatusTransform,
} from "./transformers.ts";
import type { ResolvedTransformer } from "./transformers.ts";

export class ACKError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ACKError";
  }
}

/**
 * See meanings of each tags
 * {@link https://mpd.readthedocs.io/en/latest/protocol.html#tags}
 */
export type Tag =
  | "artist"
  | "artistsort"
  | "album"
  | "albumsort"
  | "albumartist"
  | "albumartistsort"
  | "title"
  | "titlesort"
  | "track"
  | "name"
  | "genre"
  | "mood"
  | "date"
  | "composer"
  | "composersort"
  | "performer"
  | "conductor"
  | "work"
  | "ensemble"
  | "movement"
  | "movementnumber"
  | "showmovement"
  | "location"
  | "grouping"
  | "comment"
  | "disc"
  | "label"
  | "musicbrainz_artistid"
  | "musicbrainz_albumid"
  | "musicbrainz_albumartistid"
  | "musicbrainz_trackid"
  | "musicbrainz_releasegroupid"
  | "musicbrainz_releasetrackid"
  | "musicbrainz_workid";

type ListOptions = {
  /**
   * Type of list to retrieve.
   */
  type: Tag;
  /**
   * Filter to apply to the list.
   */
  filter?: Filter | Filter[] | string;
};

type ListGroupOptions = {
  /**
   * Type of list to retrieve.
   */
  type: string;
  /**
   * Filter to apply to the list.
   */
  filter?: Filter | Filter[] | string;
  /**
   * Grouping to apply to the list.
   */
  group: string;
};

const isGroupListOptions = (
  options: ListOptions | ListGroupOptions,
): options is ListGroupOptions => {
  return "group" in options;
};

export class MPD {
  conn: TCPConnection | null = null;
  idling: boolean = false;
  #host: string;
  #port: number;
  constructor(connection: TCPConnection, host: string, port: number) {
    this.conn = connection;
    this.#host = host
    this.#port = port
  }
  async sendMessage(message: string): Promise<string> {
    assert(this.conn, "Not connected to MPD");
    await this.conn.write(new TextEncoder().encode(message + "\n"));
    return this.conn.readAll();
  }

  async currentSong(): Promise<Record<string, string>> {
    assert(this.conn, "Not connected to MPD");
    const result = await this.sendMessage("currentsong");
    return parseUnknown(result);
  }

  async status(): Promise<ResolvedTransformer<typeof StatusTransform>> {
    const result = await this.sendMessage("status");
    if (result.startsWith("ACK")) {
      throw new ACKError(result);
    }
    return parse(result, StatusTransform);
  }
  async stats(): Promise<ResolvedTransformer<typeof StatsTransform>> {
    const result = await this.sendMessage("stats");
    if (result.startsWith("ACK")) {
      throw new Error(result);
    }
    return parse(result, StatsTransform);
  }

  /**
   * {@link https://mpd.readthedocs.io/en/stable/protocol.html#command-find|Find}
   *
   * Search the database for songs matching FILTER (see {@link https://www.musicpd.org/doc/html/protocol.html#filters|Filters}).
   *
   * @param tag Type of tag to search for.
   * @param value Value of the tag to search for.
   * @param sort Sorts the result by the specified tag. The sort is descending if the tag is prefixed with a minus (‘-‘)
   * @param window window can be used to query only a portion of the real response. The parameter is two zero-based record numbers; a start number and an end number.
   */
  async find(options: {
    filter: Filter | Filter[] | string;
    sort?: string;
    window?: [number, number];
  }): Promise<Record<string, string>[]> {
    let msg = `find ${createFilter(options.filter)}`;
    if (options.sort) {
      msg += ` sort ${options.sort}`;
    }
    if (options.window) {
      msg += ` window ${options.window[0]}:${options.window[1]}`;
    }
    const result = await this.sendMessage(msg);

    return parseUnknownList(result, "file");
  }

  async list(
    options: ListGroupOptions,
  ): Promise<{ group: string; values: string[] }[]>;
  async list(options: ListOptions): Promise<Record<string, string>[]>;
  async list(
    options: ListOptions | ListGroupOptions,
  ): Promise<Record<string, string>[] | { group: string; values: string[] }[]> {
    let msg = `list ${options.type} ${createFilter(options.filter)}`;

    if (isGroupListOptions(options)) {
      msg += ` group ${options.group}`;
    }
    const result = await this.sendMessage(msg);
    if (isGroupListOptions(options)) {
      return parseUnknownGroup(result, options.group);
    }
    return parseUnknownList(result, options.type);
  }

  async idle(subsystems: string){
    if(!this.idling) {
      const worker = new Worker(
        new URL("./idleWorker.ts", import.meta.url).href,
        {
          type: "module",
        },
      );
      worker.postMessage({subsystems: subsystems, host: this.#host, port: this.#port});
      worker.onmessage = (e) => {
        console.log(e.data)
        this.idling = false
      }
      this.idling = true
    }
    else {
      console.log("Already idling")
    }
  }
}
