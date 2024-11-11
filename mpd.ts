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
  type: Tag;
  /**
   * Filter to apply to the list.
   */
  filter?: Filter | Filter[] | string;
  /**
   * Grouping to apply to the list.
   */
  group: Tag;
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
    this.#host = host;
    this.#port = port;
  }

  /**
   * Send message to MPD and returns response
   * @param message Message to send
   * @param binary If true, data in Uint8Array format. Else return as string  
   */
  async sendMessage(message: string): Promise<string> 
  async sendMessage(message: string, binary: false): Promise<string> 
  async sendMessage(message: string, binary: true): Promise<Uint8Array> 
  async sendMessage(message: string, binary?: boolean): Promise<string | Uint8Array> {
    assert(this.conn, "Not connected to MPD");
    if (this.idling) {
      //console.log("Idling, sending noidle")
      const noidleBuffer = new Uint8Array(1);
      await this.conn.write(new TextEncoder().encode("noidle\n"));
      await this.conn.read(noidleBuffer);
    }
    await this.conn.write(new TextEncoder().encode(message + "\n"));
    return this.conn.readAll(binary);
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
    sort?: Tag;
    window?: [start: number, end: number];
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

  idle(subsystems: string): Promise<string> {
    return new Promise((res, rej) => {
      let worker: Worker;
      if (!this.idling) {
        worker = new Worker(
          new URL("./idleWorker.ts", import.meta.url).href,
          {
            type: "module",
          },
        );
        worker.postMessage({
          subsystems: subsystems,
          host: this.#host,
          port: this.#port,
        });
        worker.onmessage = (e) => {
          this.idling = false;
          res(e.data);
        };
        worker.onerror = (e) => {
          this.idling = false;
          rej(e.error);
        };
        this.idling = true;
      } else {
        rej(new Error("Already idling"));
      }
    });
  }


  /**
   * Execute command list call and return all values in one object
   * @returns Command list responses objects combined into single object
   */
  async commandList(...commands: string[]): Promise<Record<string, string>>{
    const msgList = ["command_list_begin", ...commands, "command_list_end"];
    const msg = msgList.join("\n")
    const response = await this.sendMessage(msg)
    return parseUnknown(response)
  }
  /**
   * Execute command list ok call and return each command response value in own object
   * @returns Command list response objects in a list
   */
  async commandListOK(...commands: string[]): Promise<Record<string, string>[]>{
    const msgList = ["command_list_ok_begin", ...commands, "command_list_end"];
    const msg = msgList.join("\n")
    const response = await this.sendMessage(msg)
    const groups = response.split("list_OK").map(parseUnknown)
    const last = groups.at(-1);
    //If last grou is empty, remove it. Happens on successful calls
    if(last && Object.keys(last).length === 0) {
      groups.pop()
    }
    return groups
  }
}
