// deno-lint-ignore-file require-await
import {
  createFilter,
  handleBinaryResponse,
  type TCPConnection,
} from "./utils.ts";
import type { AnyFilter, BinaryResponse, MPDProtocol, Tag } from "./types.ts";
import { concat } from "@std/bytes";
import type { TCPClient } from "./main.ts";

export class ACKError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ACKError";
  }
}

type ListOptions = {
  /**
   * Type of list to retrieve.
   */
  type: Tag;
  /**
   * Filter to apply to the list.
   */
  filter?: AnyFilter;
};

type ListGroupOptions = {
  /**
   * Filter to apply to the list.
   */
  filter?: AnyFilter;
  /**
   * Grouping to apply to the list.
   */
  group?: Tag;
};

const rangeToCmd = (range: [start: number, end: number] | number): string => {
  if (Array.isArray(range)) {
    return range.join(":");
  }
  return `${range}`;
};

const relativeToCmd = (
  position: number | undefined,
  relative: "+" | "-" | undefined,
): string => {
  const pos = position || position === 0 ? `${position}` : "";
  return pos && relative ? `${relative}${pos}` : `${pos}`;
};

const isGroupListOptions = (
  options: ListOptions | ListGroupOptions,
): options is ListGroupOptions => {
  return "group" in options;
};

const handleError = (input: string): string => {
  if (input.startsWith("ACK ")) {
    throw new ACKError(input);
  }
  return input;
};

export class MPD implements MPDProtocol {
  #conn: TCPClient<TCPConnection>;
  idling: boolean = false;
  #host: string;
  #port: number;
  constructor(
    connection: TCPClient<TCPConnection>,
    host: string,
    port: number,
  ) {
    this.#conn = connection;
    this.#host = host, this.#port = port;
  }

  /* async connect() {
    await Promise.all([this.#conn.connect(), this.#idleConnection.connect()]);
  } */

  /**
   * Send message to MPD and returns response
   * @param message Message to send
   */
  async sendCommand(
    message: string,
  ): Promise<string> {
    if (this.idling) {
      const idleConnection = await this.#conn.connect(this.#host, this.#port);
      //console.log("Idling, sending noidle")
      const noidleBuffer = new Uint8Array(128);
      await idleConnection.write(new TextEncoder().encode("noidle\n"));
      await idleConnection.read(noidleBuffer);
    }
    const connection = await this.#conn.connect(this.#host, this.#port);
    await connection.write(new TextEncoder().encode(message + "\n"));
    const response = await connection.readAll();
    connection.close();
    return response;
  }

  async sendCommandBinary(
    message: string,
    offset: number = 0,
  ): Promise<BinaryResponse> {
    const connection = await this.#conn.connect(this.#host, this.#port);

    if (this.idling) {
      const noidleBuffer = new Uint8Array(128);
      await connection.write(new TextEncoder().encode("noidle\n"));
      await connection.read(noidleBuffer);
    }

    let off = offset;
    const meta: {
      type?: string;
      size: number;
    } = {
      type: "",
      size: 0,
    };
    const chunks: Uint8Array[] = [];
    while (true) {
      await connection.write(
        new TextEncoder().encode(`${message} ${off}\n`),
      );
      const binary = await connection.readAll(true);
      const res = handleBinaryResponse(binary);

      chunks.push(res.binary);
      off += res.headers.binarySize;
      if (off >= res.headers.size) {
        meta.size = res.headers.size;
        meta.type = res.headers.type;
        break;
      }
    }
    const data = concat(chunks);
    return {
      meta: meta,
      binary: data,
    };
  }

  async clearError(): Promise<void> {
    this.sendCommand("clearerror");
  }
  async consume(state: 1 | 0): Promise<void> {
    this.sendCommand(`consume ${state}`);
  }
  async crossfade(seconds: number): Promise<string> {
    return this.sendCommand(`crossfade ${seconds}`);
  }
  async mixrampdb(deciBels: number): Promise<string> {
    return this.sendCommand(`mixrampdb ${deciBels}`);
  }
  async mixrampdelay(seconds: number): Promise<string> {
    return this.sendCommand(`mixrampdelay ${seconds}`);
  }
  async random(state: 1 | 0): Promise<void> {
    this.sendCommand(`random ${state}`);
  }
  async repeat(state: 1 | 0): Promise<void> {
    this.sendCommand(`repeat ${state}`);
  }
  async setVolume(volume: number): Promise<void> {
    this.sendCommand(`setvol ${volume}`);
  }
  async getVolume(): Promise<string> {
    return this.sendCommand(`getvol`);
  }
  async single(state: 1 | 0 | "oneshot"): Promise<void> {
    this.sendCommand(`single ${state}`);
  }
  async replay_gain_mode(
    mode: "off" | "track" | "album" | "auto",
  ): Promise<void> {
    this.sendCommand(`replay_gain_mode ${mode}`);
  }
  async replay_gain_status(): Promise<string> {
    return this.sendCommand(`replay_gain_status`);
  }
  async next(): Promise<void> {
    this.sendCommand(`next`);
  }
  async pause(state?: 1 | 0): Promise<void> {
    await this.sendCommand(`pause ${state ?? ""}`);
  }
  async play(SONGPOS: number): Promise<void> {
    this.sendCommand(`play ${SONGPOS}`);
  }
  async playId(SONGID: string): Promise<void> {
    this.sendCommand(`playid ${SONGID}`);
  }
  async previous(): Promise<void> {
    this.sendCommand(`previous`);
  }
  async seek(SONGPOS: number, TIME: number): Promise<void> {
    this.sendCommand(`seek ${SONGPOS} ${TIME}`);
  }
  async seekId(SONGID: string, TIME: number): Promise<void> {
    this.sendCommand(`seekid ${SONGID} ${TIME}`);
  }
  async seekCur(TIME: number, relative?: "+" | "-"): Promise<void> {
    this.sendCommand(`seekcur ${relative || ""}${TIME}`);
  }
  async stop(): Promise<void> {
    this.sendCommand(`spot`);
  }
  async add(uri: string): Promise<void> {
    this.sendCommand(`add ${uri}`);
  }
  async addId(
    uri: string,
    position?: number,
    relative?: "+" | "-",
  ): Promise<string> {
    const pos = position || position === 0 ? `${position}` : "";
    const time = pos && relative ? `${relative}${pos}` : `${pos}`;
    return this.sendCommand(`addid ${uri} ${time}`);
  }
  async clear(): Promise<void> {
    this.sendCommand(`clear`);
  }
  async delete(position: number | [start: number, end: number]): Promise<void> {
    this.sendCommand(`delete ${rangeToCmd(position)}`);
  }
  async deleteId(songid: number): Promise<void> {
    this.sendCommand(`delete ${songid}`);
  }
  async move(
    from: number | [start: number, end: number],
    to: number,
    relative?: "+" | "-",
  ): Promise<void> {
    this.sendCommand(`move ${rangeToCmd(from)} ${relativeToCmd(to, relative)}`);
  }
  async playlistFind(filter: AnyFilter): Promise<string> {
    return this.sendCommand(`playlistfind ${createFilter(filter)}`);
  }
  async playlistId(songid?: string): Promise<string> {
    return this.sendCommand(`playlistfind ${songid}`);
  }
  async playlistInfo(
    songpos?: number | [start: number, end: number],
  ): Promise<string> {
    if (songpos) {
      return this.sendCommand(`playlistinfo ${rangeToCmd(songpos)}`);
    }
    return this.sendCommand(`playlistinfo`);
  }
  async playlistSearch(filter: AnyFilter): Promise<string> {
    return this.sendCommand(`playlistfilter ${createFilter(filter)}`);
  }
  async playlistChanges(
    version: string,
    range?: [start: number, end: number],
  ): Promise<string> {
    if (range) {
      return this.sendCommand(`plchanges ${version} ${rangeToCmd(range)}`);
    }
    return this.sendCommand(`plchanges ${version}`);
  }
  async playlistChangePosId(
    version: string,
    range?: [start: number, end: number],
  ): Promise<string> {
    if (range) {
      return this.sendCommand(`plchangesposid ${version} ${rangeToCmd(range)}`);
    }
    return this.sendCommand(`plchangesposid ${version}`);
  }
  async prio(
    priority: number,
    ...range: [start: number, end: number][]
  ): Promise<void> {
    this.sendCommand(`prio ${priority} ${range.map(rangeToCmd).join(" ")}`);
  }
  async prioId(priority: number, ...id: number[]): Promise<void> {
    this.sendCommand(`prioid ${priority} ${id.join(" ")}`);
  }
  async rangeId(
    id: number,
    range: { start?: number; end?: number },
  ): Promise<void> {
    this.sendCommand(
      `rangeid ${id} ${(range.start || "")}:${(range.end || "")}`,
    );
  }
  async shuffle(range?: [start: number, end: number]): Promise<void> {
    if (range) {
      this.sendCommand(`shuffle ${rangeToCmd(range)}`);
    } else {
      this.sendCommand(`shuffle`);
    }
  }
  async swap(pos1: number, pos2: number): Promise<void> {
    this.sendCommand(`swap ${pos1} ${pos2}`);
  }
  async swapId(pos1: number, pos2: number): Promise<void> {
    this.sendCommand(`swapid ${pos1} ${pos2}`);
  }
  async addTagId(songId: number, tag: string, value: string): Promise<void> {
    this.sendCommand(`addtagid ${songId} ${tag} ${value}`);
  }
  async clearTagId(songId: number, tag?: string): Promise<void> {
    this.sendCommand(`cleartagid ${songId} ${tag || ""}`);
  }
  async listPlaylist(name: string): Promise<string> {
    return this.sendCommand(`listplaylist ${name}`);
  }
  async listPlaylistinfo(name: string): Promise<string> {
    return this.sendCommand(`listplaylistinfo ${name}`);
  }
  async listPlaylists(): Promise<string> {
    return this.sendCommand(`listplaylists`);
  }
  async loadPlaylist(
    name: string,
    range?: { start: number; end?: number },
    position?: number,
    relative?: "+" | "-",
  ): Promise<void> {
    if (range) {
      this.sendCommand(
        `load ${name} ${range.start}:${range.end} ${
          relativeToCmd(position, relative)
        }`,
      );
    } else {
      this.sendCommand(
        `load ${name}`,
      );
    }
  }
  async playlistAdd(
    name: string,
    uri: string,
    position?: number,
  ): Promise<void> {
    this.sendCommand(`playlistadd ${name} ${uri} ${position ?? ""}`);
  }
  async playlistClear(name: string): Promise<void> {
    this.sendCommand(`playlistclear ${name}`);
  }
  async playlistDelete(
    name: string,
    songPos: number | [start: number, end: number],
  ): Promise<void> {
    this.sendCommand(`playlistdelete ${name} ${rangeToCmd(songPos)}`);
  }
  async playlistMove(name: string, from: number, to: number): Promise<void> {
    this.sendCommand(`playlistmove ${name} ${from} ${to}`);
  }
  async playlistRename(oldName: string, newName: string): Promise<void> {
    this.sendCommand(`rename ${oldName} ${newName}`);
  }
  async playlistRemove(name: string): Promise<void> {
    this.sendCommand(`rm ${name}`);
  }
  async playlistSave(name: string): Promise<void> {
    this.sendCommand(`save ${name}`);
  }
  async albumArt(
    uri: string,
    offsets: number,
  ): Promise<BinaryResponse> {
    return this.sendCommandBinary(`albumart ${uri}`, offsets);
  }
  async count(
    filter: AnyFilter,
    group?: Tag,
  ): Promise<string> {
    if (group) {
      return this.sendCommand(`count ${createFilter(filter)} group ${group}`);
    } else {
      return this.sendCommand(`count ${createFilter(filter)}`);
    }
  }
  async getFingerPrint(uri: string): Promise<string> {
    return this.sendCommand(`getfingerprint ${uri}`);
  }
  async findAdd(
    filter: AnyFilter,
    options?: {
      sort?: { tag: Tag; descending: boolean };
      window?: [start: number, end: number];
      position?: number;
    },
  ): Promise<string> {
    if (options) {
      const order = options.sort?.descending ? "-" : "";
      const sort = options.sort ? `sort ${order}${options.sort.tag}` : "";
      const window = options.window
        ? `window ${rangeToCmd(options.window)}`
        : "";
      const position = options.position ? `position ${options.position}` : "";
      return this.sendCommand(
        `findadd ${createFilter(filter)} ${sort} ${window} ${position}`,
      );
    }
    return this.sendCommand(`findadd ${createFilter(filter)}`);
  }
  async listFiles(uri: string): Promise<string> {
    return this.sendCommand(`listfiles ${uri}`);
  }
  async readComments(uri: string): Promise<string> {
    return this.sendCommand(`readcomments ${uri}`);
  }
  readPicture(
    uri: string,
    offset: number = 0,
  ): Promise<BinaryResponse> {
    return this.sendCommandBinary(`readpicture "${uri}"`, offset);
  }
  async search(
    filter: AnyFilter,
    options?: {
      sort?: { tag: Tag; descending?: boolean };
      window?: [start: number, end: number];
    },
  ): Promise<string> {
    if (options) {
      const order = options.sort?.descending ? "-" : "";
      const sort = options.sort ? `sort ${order}${options.sort.tag}` : "";
      const window = options.window
        ? `window ${rangeToCmd(options.window)}`
        : "";
      return this.sendCommand(
        `search ${createFilter(filter)} ${sort} ${window}`,
      );
    }
    return this.sendCommand(
      `search ${createFilter(filter)}`,
    );
  }
  searchAdd(
    filter: AnyFilter,
    options?: {
      sort?: { tag: Tag; descending?: boolean };
      window?: [start: number, end: number];
      position?: number;
    },
  ): Promise<string> {
    if (options) {
      const order = options.sort?.descending ? "-" : "";
      const sort = options.sort ? `sort ${order}${options.sort.tag}` : "";
      const window = options.window
        ? `window ${rangeToCmd(options.window)}`
        : "";
      const position = typeof options.position === "number"
        ? options.position.toString(10)
        : "";
      return this.sendCommand(
        `searchadd ${
          createFilter(filter)
        } ${sort} ${window} ${options} ${position}`,
      );
    }
    return this.sendCommand(
      `searchadd ${createFilter(filter)}`,
    );
  }
  searchAddPlaylist(
    name: string,
    filter: AnyFilter,
    options?: {
      sort?: { tag: Tag; descending?: boolean };
      window?: [start: number, end: number];
      position?: number;
    },
  ): Promise<string> {
    if (options) {
      const order = options.sort?.descending ? "-" : "";
      const sort = options.sort ? `sort ${order}${options.sort.tag}` : "";
      const window = options.window
        ? `window ${rangeToCmd(options.window)}`
        : "";
      const position = options.position ? `position ${options.position}` : "";
      return this.sendCommand(
        `searchaddpl ${name} ${
          createFilter(filter)
        } ${sort} ${window} ${position}`,
      );
    }
    return this.sendCommand(
      `searchaddpl ${name} ${createFilter(filter)}`,
    );
  }
  async update(path?: string): Promise<string> {
    return this.sendCommand(`update ${path || ""}`);
  }
  async rescan(path?: string): Promise<string> {
    return this.sendCommand(`rescan ${path || ""}`);
  }
  async mount(path: string, uri: string): Promise<void> {
    this.sendCommand(`mount ${path} ${uri}`);
  }
  async unmount(path: string): Promise<void> {
    this.sendCommand(`mount ${path}`);
  }
  async listMounts(): Promise<string> {
    return this.sendCommand(`listmounts`);
  }
  async listNeighbors(): Promise<string> {
    return this.sendCommand(`listneighbors`);
  }
  async addSticker(
    type: string,
    uri: string,
    name: string,
    value: string,
  ): Promise<void> {
    this.sendCommand(`sticker set ${type} ${uri} ${name} ${value}`);
  }
  async getStickers(
    type: string,
    uri: string,
  ): Promise<string> {
    return this.sendCommand(`sticker get ${type} ${uri} ${name}`);
  }
  async deleteSticker(type: string, uri: string, name?: string): Promise<void> {
    this.sendCommand(`sticker delete ${type} ${uri} ${name}`);
  }
  async findStickers(
    type: string,
    uri: string,
    name: string,
    value?: string,
    compare: "=" | "<" | ">" = "=",
  ): Promise<string> {
    if (value) {
      return this.sendCommand(
        `sticker find ${type} ${uri} ${name} ${compare} ${value}`,
      );
    }
    return this.sendCommand(`sticker find ${type} ${uri} ${name}`);
  }

  async listStickers(type: string, uri: string): Promise<string> {
    return this.sendCommand(`sticker list ${type} ${uri}`);
  }

  async kill(): Promise<void> {
    this.sendCommand(`kill`);
  }
  async password(password: string): Promise<void> {
    this.sendCommand(`password ${password}`);
  }
  async binaryLimit(size: number): Promise<void> {
    this.sendCommand(`binarylimit ${size}`);
  }
  async tagTypes(): Promise<string> {
    return this.sendCommand(`tagtypes`);
  }
  async tagTypesDisable(...tags: string[]): Promise<void> {
    this.sendCommand(`tagtypes disable ${tags.join(" ")}`);
  }
  async tagTypesEnable(...tags: string[]): Promise<void> {
    this.sendCommand(`tagtypes enable ${tags.join(" ")}`);
  }
  async tagTypesClear(): Promise<void> {
    this.sendCommand(`tagtypes clear`);
  }
  async tagTypesAll(): Promise<void> {
    this.sendCommand(`tagtypes all`);
  }
  async partition(name: string): Promise<void> {
    this.sendCommand(`partition ${name}`);
  }
  async listPartitions(): Promise<string> {
    return this.sendCommand(`listpartitions`);
  }
  async newPartition(name: string): Promise<void> {
    this.sendCommand(`newpartition ${name}`);
  }
  async deletePartition(name: string): Promise<void> {
    this.sendCommand(`delpartition ${name}`);
  }
  async moveOutput(outputName: string): Promise<void> {
    this.sendCommand(`moveoutput ${outputName}`);
  }
  async listOutputs(): Promise<string> {
    return this.sendCommand(`outputs`);
  }
  async enableOutput(id: number): Promise<void> {
    this.sendCommand(`enableoutput ${id}`);
  }
  async disableOutput(id: number): Promise<void> {
    this.sendCommand(`disableoutput ${id}`);
  }
  async toggleOutput(id: number): Promise<void> {
    this.sendCommand(`toggleoutput ${id}`);
  }
  async outputSet(id: number, name: string, value: string): Promise<string> {
    return this.sendCommand(`outputset ${id} ${name} ${value}`);
  }
  async config(): Promise<string> {
    return this.sendCommand(`config`);
  }
  async commands(): Promise<string> {
    return this.sendCommand(`commands`);
  }
  async notCommands(): Promise<string> {
    return this.sendCommand(`notcommands`);
  }
  async urlHandlers(): Promise<string> {
    return this.sendCommand(`urlhandlers`);
  }
  async decoders(): Promise<string> {
    return this.sendCommand(`decoders`);
  }
  async subscribe(name: string): Promise<void> {
    this.sendCommand(`subscribe ${name}`);
  }
  async unsubscribe(name: string): Promise<void> {
    this.sendCommand(`unsubscribe ${name}`);
  }
  async channels(): Promise<string> {
    return this.sendCommand(`channels`);
  }
  async readMessages(): Promise<string> {
    return this.sendCommand(`readmessages`);
  }
  async sendMessage(channel: string, text: string): Promise<void> {
    this.sendCommand(`sendmessage ${channel} ${text}`);
  }

  async currentSong(): Promise<string> {
    const result = await this.sendCommand("currentsong");
    return handleError(result);
  }

  async status(): Promise<string> {
    const result = await this.sendCommand("status");
    return handleError(result);
  }
  async stats(): Promise<string> {
    const result = await this.sendCommand("stats");
    return handleError(result);
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
  async find(
    filter: AnyFilter,
    options?: {
      sort?: { tag: Tag; descending?: boolean };
      window?: [start: number, end: number];
    },
  ): Promise<string> {
    if (options) {
      const order = options.sort?.descending ? "-" : "";
      const sort = options.sort ? `sort ${order}${options.sort.tag}` : "";
      const window = options.window
        ? `window ${rangeToCmd(options.window)}`
        : "";
      return this.sendCommand(
        `find ${createFilter(filter)} ${sort} ${window}`,
      );
    }
    return this.sendCommand(
      `find ${createFilter(filter)}`,
    );
  }

  async list(
    type: Tag,
    options?: ListGroupOptions,
  ): Promise<string> {
    let msg = `list ${type}`;
    if (options) {
      msg += ` ${createFilter(options.filter)}`;
      if (isGroupListOptions(options)) {
        msg += ` group ${options.group}`;
      }
    }
    const result = await this.sendCommand(msg);
    return handleError(result);
  }

  async idle(...subsystems: string[]): Promise<string> {
    if (!this.idling) {
      const connection = await this.#conn.connect(this.#host, this.#port);
      await connection.write(
        new TextEncoder().encode(`idle ${subsystems.join(" ")}\n`),
      );
      const result = await connection.readAll();
      return handleError(result);
    }
    throw new Error("Already idling");
  }
  async noidle(): Promise<string> {
    const connection = await this.#conn.connect(this.#host, this.#port);
    const noidleBuffer = new Uint8Array(128);
    await connection.write(new TextEncoder().encode("noidle\n"));
    await connection.read(noidleBuffer);
    const result = new TextDecoder().decode(noidleBuffer);
    this.idling = false;
    return handleError(result);
  }

  async commandList(...commands: string[]): Promise<string> {
    const msgList = ["command_list_begin", ...commands, "command_list_end"];
    const msg = msgList.join("\n");
    const result = await this.sendCommand(msg);
    return handleError(result);
  }

  async commandListOK(
    ...commands: string[]
  ): Promise<string> {
    const msgList = ["command_list_ok_begin", ...commands, "command_list_end"];
    const msg = msgList.join("\n");
    const result = await this.sendCommand(msg);
    return handleError(result);
  }

  async playlist(): Promise<string> {
    const result = await this.sendCommand("playlist");
    return handleError(result);
  }
  async playlistinfo(): Promise<string> {
    const result = await this.sendCommand("playlistinfo");
    return handleError(result);
  }

  async ping(): Promise<string> {
    const result = await this.sendCommand("ping");
    return handleError(result);
  }
}
