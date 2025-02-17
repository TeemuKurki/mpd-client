// deno-lint-ignore-file require-await
import {
  createFilter,
  handleBinaryResponse,
  type TCPConnection,
} from "./utils.ts";
import type { AnyFilter, BinaryResponse, Tag } from "./types.ts";
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

export type ListGroupOptions = {
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

/**
 * Implements MPD Protocol
 */
export class MPD {
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

  // --- Status Commands ---

  /**
   * Clears the current error message in status (this is also accomplished by any command that starts playback).
   */
  async clearError(): Promise<void> {
    this.sendCommand("clearerror");
  }
  /**
   * Displays the current song in the playlist.
   */
  async currentSong(): Promise<string> {
    const result = await this.sendCommand("currentsong");
    return handleError(result);
  }
  /**
   * Waits until there is a noteworthy change in one or more of MPD’s subsystems.
   * @param subsystems See: {@link https://mpd.readthedocs.io/en/stable/protocol.html#command-idle|MPD subsystems}
   */
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
  /**
   * Cancel idle
   * @returns idle result. Might be empty at this time.
   */
  async noidle(): Promise<string> {
    const connection = await this.#conn.connect(this.#host, this.#port);
    const noidleBuffer = new Uint8Array(128);
    await connection.write(new TextEncoder().encode("noidle\n"));
    await connection.read(noidleBuffer);
    const result = new TextDecoder().decode(noidleBuffer);
    this.idling = false;
    return handleError(result);
  }

  /**
   * Displays the current status of the player.
   */
  async status(): Promise<string> {
    const result = await this.sendCommand("status");
    return handleError(result);
  }
  /**
   * Shows statistics about the database.
   */
  async stats(): Promise<string> {
    const result = await this.sendCommand("stats");
    return handleError(result);
  }

  // --- Playback Options ---

  /**
   * Sets consume state to STATE, STATE should be 0, 1. When consume is activated, each song played is removed from playlist.
   * @param state
   */
  async consume(state: 1 | 0): Promise<void> {
    this.sendCommand(`consume ${state}`);
  }
  /**
   * Sets crossfading between songs. {@link https://mpd.readthedocs.io/en/stable/user.html#crossfading|Cross-Fading}
   * @param seconds
   */
  async crossfade(seconds: number): Promise<string> {
    return this.sendCommand(`crossfade ${seconds}`);
  }
  /**
   * Sets the threshold at which songs will be overlapped. See {@link https://mpd.readthedocs.io/en/stable/user.html#mixramp|MixRamp}.
   * @param deciBels
   */
  async mixrampdb(deciBels: number): Promise<string> {
    return this.sendCommand(`mixrampdb ${deciBels}`);
  }
  /**
   * Additional time subtracted from the overlap calculated by mixrampdb. A value of “nan” disables MixRamp overlapping and falls back to crossfading. See {@link https://mpd.readthedocs.io/en/stable/user.html#mixramp|MixRamp}.
   * @param seconds
   */
  async mixrampdelay(seconds: number): Promise<string> {
    return this.sendCommand(`mixrampdelay ${seconds}`);
  }
  /**
   * Sets random state to STATE, STATE should be 0 or 1.
   * @param state
   */
  async random(state: 1 | 0): Promise<void> {
    this.sendCommand(`random ${state}`);
  }
  /**
   * Sets repeat state to STATE, STATE should be 0 or 1.
   *
   * If enabled, MPD keeps repeating the whole queue ({@link https://mpd.readthedocs.io/en/stable/protocol.html#command-single|single mode} disabled) or the current song ({@link https://mpd.readthedocs.io/en/stable/protocol.html#command-single|single mode} enabled).
   *
   * If {@link https://mpd.readthedocs.io/en/stable/protocol.html#command-random|random mode} is also enabled, the playback order will be shuffled each time the queue gets repeated.
   *
   * @param state
   */
  async repeat(state: 1 | 0): Promise<void> {
    this.sendCommand(`repeat ${state}`);
  }
  /**
   * Sets volume (0-100).
   * @param volume The desired volume level (0-100).
   */
  async setVolume(volume: number): Promise<void> {
    this.sendCommand(`setvol ${volume}`);
  }
  /**
   * Read the volume. The result is a `volume:` line like in {@link https://mpd.readthedocs.io/en/stable/protocol.html#command-status|status}. If there is no mixer, MPD will emit an empty response.
   */
  async getVolume(): Promise<string> {
    return this.sendCommand(`getvol`);
  }
  /**
   * Sets single state to `STATE`, `STATE` should be 0, 1 or oneshot. When single is activated, playback is stopped after current song, or song is repeated if the ‘repeat’ mode is enabled.
   * @param state
   */
  async single(state: 1 | 0 | "oneshot"): Promise<void> {
    this.sendCommand(`single ${state}`);
  }
  /**
   * Sets the replay gain mode. One of off, track, album, auto . Changing the mode during playback may take several seconds, because the new settings do not affect the buffered data. This command triggers the options idle event.
   * @param mode
   */
  async replay_gain_mode(
    mode: "off" | "track" | "album" | "auto",
  ): Promise<void> {
    this.sendCommand(`replay_gain_mode ${mode}`);
  }
  /**
   * Prints replay gain options. Currently, only the variable `replay_gain_mode` is returned.
   */
  async replay_gain_status(): Promise<string> {
    return this.sendCommand(`replay_gain_status`);
  }

  // --- Playback Controls ---

  /**
   * Plays next song in the playlist.
   */
  async next(): Promise<void> {
    this.sendCommand(`next`);
  }
  /**
   * Pause or resume playback. Pass `1` to pause playback or `0` to resume playback. Without the parameter, the pause state is toggled.
   * @param state `1` to pause, `0` to resume, undefined for toggle.
   */
  async pause(state?: 1 | 0): Promise<void> {
    const cmd = `pause ${state ?? ""}`;
    await this.sendCommand(cmd);
  }
  /**
   * Begins playing the playlist at song number `SONGPOS`.
   * @param SONGPOS
   */
  async play(SONGPOS: number): Promise<void> {
    this.sendCommand(`play ${SONGPOS}`);
  }
  /**
   * Begins playing the playlist at song SONGID.
   * @param SONGID
   */
  async playId(SONGID: string): Promise<void> {
    this.sendCommand(`playid ${SONGID}`);
  }
  /**
   * Returns to the previous song in the playlist.
   */
  async previous(): Promise<void> {
    this.sendCommand(`previous`);
  }
  /**
   * Seeks to the position TIME (in seconds; fractions allowed) of entry SONGPOS in the playlist.
   * @param SONGPOS Song position in playlist
   * @param TIME The position to seek to (in seconds).
   */
  async seek(SONGPOS: number, TIME: number): Promise<void> {
    this.sendCommand(`seek ${SONGPOS} ${TIME}`);
  }
  /**
   * Seeks to the position TIME (in seconds; fractions allowed) of song SONGID.
   * @param SONGID Song id in playlist
   * @param TIME The position to seek to (in seconds).
   */
  async seekId(SONGID: string, TIME: number): Promise<void> {
    this.sendCommand(`seekid ${SONGID} ${TIME}`);
  }
  /**
   * Seeks to the position TIME (in seconds; fractions allowed) within the current song. If 'relative' set to + or -, then the time is relative to the current playing position.
   * @param TIME The position to seek to (in seconds).
   * @param relative set to + or -, then the time is relative to the current playing position.
   */
  async seekCur(TIME: number, relative?: "+" | "-"): Promise<void> {
    this.sendCommand(`seekcur ${relative || ""}${TIME}`);
  }
  /**
   * Stops playing.
   */
  async stop(): Promise<void> {
    this.sendCommand(`stop`);
  }

  // --- Queue Management ---

  /**
   * Adds the file URI to the playlist (directories add recursively). URI can also be a single file.
   * @param uri The URI of the song to add.
   */
  async add(uri: string): Promise<void> {
    this.sendCommand(`add ${uri}`);
  }
  /**
   * Adds a song to the playlist (non-recursive) and returns the song id. URI is always a single file or URL.
   * @param uri The URI of the song to add.
   * @param position If given, then the song is inserted at the specified position.
   * @param relative If given, then position is relative to current song.
   * @example
   * addId("/path/to/song.flac", 0, "+") //Sets song right after current song
   */
  async addId(
    uri: string,
    position?: number,
    relative?: "+" | "-",
  ): Promise<string> {
    const pos = position || position === 0 ? `${position}` : "";
    const time = pos && relative ? `${relative}${pos}` : `${pos}`;
    return this.sendCommand(`addid ${uri} ${time}`);
  }
  /**
   * Clears the queue.
   */
  async clear(): Promise<void> {
    this.sendCommand(`clear`);
  }
  /**
   * Deletes a song from the playlist.
   * @param position The position of the song to delete.
   */
  async delete(position: number | [start: number, end: number]): Promise<void> {
    this.sendCommand(`delete ${rangeToCmd(position)}`);
  }

  /**
   * Deletes a song `songid` from the playlist.
   * @param songid
   */
  async deleteId(songid: number): Promise<void> {
    this.sendCommand(`delete ${songid}`);
  }
  /**
   * Moves a song to a different position in the playlist.
   * @param from The current position of the song(s).
   * @param to The new position of the song(s).
   * @param relative If given, ´to´ is relative to the current song. If ´+´ add after current song, or if ´-´ add before current song
   */
  async move(
    from: number | [start: number, end: number],
    to: number,
    relative?: "+" | "-",
  ): Promise<void> {
    this.sendCommand(`move ${rangeToCmd(from)} ${relativeToCmd(to, relative)}`);
  }

  /**
   * Displays the queue.
   *
   * Do not use this, instead use {@link playlistInfo}.
   * @deprecated
   */
  async playlist(): Promise<string> {
    const result = await this.sendCommand("playlist");
    return handleError(result);
  }

  /**
   * Search the queue for songs matching FILTER (see {@link https://mpd.readthedocs.io/en/stable/protocol.html#filter-syntax|Filters}).
   * @param filter
   */
  async playlistFind(filter: AnyFilter): Promise<string> {
    return this.sendCommand(`playlistfind ${createFilter(filter)}`);
  }
  /**
   * Displays a list of songs in the playlist. `songid` is optional and specifies a single song to display info for.
   * @param songid
   */
  async playlistId(songid?: string): Promise<string> {
    return this.sendCommand(`playlistfind ${songid}`);
  }
  /**
   * Displays a list of all songs in the playlist, or if the optional argument is given, displays information only for the song `SONGPOS` or the range of songs `START:END`
   * @param songpos Song position in playlist or range
   */
  async playlistInfo(
    songpos?: number | [start: number, end: number],
  ): Promise<string> {
    if (songpos) {
      return this.sendCommand(`playlistinfo ${rangeToCmd(songpos)}`);
    }
    return this.sendCommand(`playlistinfo`);
  }
  /**
   * Search the queue for songs matching FILTER (see {@link https://mpd.readthedocs.io/en/stable/protocol.html#filter-syntax|Filters}). Parameters have the same meaning as for find, except that search is not case sensitive.
   * @param filter
   */
  async playlistSearch(filter: AnyFilter): Promise<string> {
    return this.sendCommand(`playlistfilter ${createFilter(filter)}`);
  }
  /**
   * Displays changed songs currently in the playlist since `VERSION`. Start and end positions may be given to limit the output to changes in the given `range`.
   *
   * To detect songs that were deleted at the end of the playlist, use playlistlength returned by status command.
   * @param version
   * @param range
   */
  async playlistChanges(
    version: string,
    range?: [start: number, end: number],
  ): Promise<string> {
    if (range) {
      return this.sendCommand(`plchanges ${version} ${rangeToCmd(range)}`);
    }
    return this.sendCommand(`plchanges ${version}`);
  }
  /**
   * Displays changed songs currently in the playlist since `VERSION`. This function only returns the position and the id of the changed song, not the complete metadata. This is more bandwidth efficient.
   *
   * To detect songs that were deleted at the end of the playlist, use playlistlength returned by status command.
   * @param version
   * @param range
   */
  async playlistChangePosId(
    version: string,
    range?: [start: number, end: number],
  ): Promise<string> {
    if (range) {
      return this.sendCommand(`plchangesposid ${version} ${rangeToCmd(range)}`);
    }
    return this.sendCommand(`plchangesposid ${version}`);
  }
  /**
   * Set the priority of the specified songs. A higher priority means that it will be played first when “random” mode is enabled.
   * A priority is an integer between 0 and 255. The default priority of new songs is 0.
   * @param priority
   * @param range
   */
  async prio(
    priority: number,
    ...range: [start: number, end: number][]
  ): Promise<void> {
    this.sendCommand(`prio ${priority} ${range.map(rangeToCmd).join(" ")}`);
  }
  /**
   * Set the priority of the specified songs. A higher priority means that it will be played first when “random” mode is enabled.
   * A priority is an integer between 0 and 255. The default priority of new songs is 0.
   *
   * @param priority
   * @param id ID of selected song
   */
  async prioId(priority: number, ...id: number[]): Promise<void> {
    this.sendCommand(`prioid ${priority} ${id.join(" ")}`);
  }
  /**
   * Since MPD 0.19 Specifies the portion of the song that shall be played. START and END are offsets in seconds (fractional seconds allowed); both are optional.
   * Omitting both means "remove the range, play everything". A song that is currently playing cannot be manipulated this way.
   * @param id ID of the song
   * @param range Range of the song to be played. If undefind, range is removed
   */
  async rangeId(
    id: number,
    range: { start?: number; end?: number },
  ): Promise<void> {
    this.sendCommand(
      `rangeid ${id} ${(range.start || "")}:${(range.end || "")}`,
    );
  }
  /**
   * Shuffles the queue. START:END is optional and specifies a range of songs.
   * @param range
   */
  async shuffle(range?: [start: number, end: number]): Promise<void> {
    if (range) {
      this.sendCommand(`shuffle ${rangeToCmd(range)}`);
    } else {
      this.sendCommand(`shuffle`);
    }
  }

  /**
   * Swaps the positions of two songs in the playlist.
   * @param pos1 The first position.
   * @param pos2 The second position.
   */
  async swap(pos1: number, pos2: number): Promise<void> {
    this.sendCommand(`swap ${pos1} ${pos2}`);
  }
  /**
   * Swaps the positions of two songs in the playlist by ids.
   *
   * @param pos1 The first position.
   * @param pos2 The second position.
   */
  async swapId(pos1: number, pos2: number): Promise<void> {
    this.sendCommand(`swapid ${pos1} ${pos2}`);
  }

  /**
   * Adds a tag to the specified song. Editing song tags is only possible for remote songs.
   * This change is volatile: it may be overwritten by tags received from the server, and the data is gone when the song gets removed from the queue.
   * @param songId ID of the song
   * @param tag Name of the tag
   * @param value Value of the tag
   */
  async addTagId(songId: number, tag: string, value: string): Promise<void> {
    this.sendCommand(`addtagid ${songId} ${tag} ${value}`);
  }
  /**
   * Removes tags from the specified song. If TAG is not specified, then all tag values will be removed.
   * Editing song tags is only possible for remote songs.
   * @param songId ID of the song
   * @param tag Name of the tag
   */
  async clearTagId(songId: number, tag?: string): Promise<void> {
    this.sendCommand(`cleartagid ${songId} ${tag || ""}`);
  }
  // --- Stored Playlists ---

  /**
   * Lists the songs in the playlist
   * @param name Name of the playlist
   */
  async listPlaylist(name: string): Promise<string> {
    return this.sendCommand(`listplaylist ${name}`);
  }
  /**
   * Lists the songs with metadata in the playlist
   * @param name Name of the playlist
   */
  async listPlaylistinfo(name: string): Promise<string> {
    return this.sendCommand(`listplaylistinfo ${name}`);
  }
  /**
   * Prints a list of the playlist directory. After each playlist name the server sends its last modification time as attribute “Last-Modified” in ISO 8601 format.
   * To avoid problems due to clock differences between clients and the server, clients should not compare this value with their local clock.
   */
  async listPlaylists(): Promise<string> {
    return this.sendCommand(`listplaylists`);
  }
  /**
   * Loads the playlist into the current queue. Playlist plugins are supported. A range may be specified to load only a part of the playlist.
   *
   * @param name The name of the playlist to load.
   * @param range Range of the playlist to load. Set `{start: 0}` to load entire playlist to certain queue position
   * @param position Specifies where the songs will be inserted into the queue
   * @param relative Position relative to current song
   */
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
  /**
   * Adds URI to the playlist NAME.m3u. NAME.m3u will be created if it does not exist.
   * @param name Name of the playlist
   * @param uri URI
   * @param position specifies where the songs will be inserted into the playlist.
   */
  async playlistAdd(
    name: string,
    uri: string,
    position?: number,
  ): Promise<void> {
    this.sendCommand(`playlistadd ${name} ${uri} ${position ?? ""}`);
  }
  /**
   * Clears the playlist NAME.m3u.
   * @param name Name of the playlist
   */
  async playlistClear(name: string): Promise<void> {
    this.sendCommand(`playlistclear ${name}`);
  }
  /**
   * Deletes `SONGPOS` from the playlist `NAME`.m3u.
   * @param name Name of the playlist
   * @param songPos Position of range of selected songs
   */
  async playlistDelete(
    name: string,
    songPos: number | [start: number, end: number],
  ): Promise<void> {
    this.sendCommand(`playlistdelete ${name} ${rangeToCmd(songPos)}`);
  }
  /**
   * Moves the song at position FROM in the playlist NAME.m3u to the position TO.
   * @param name Name of the playlist
   * @param from
   * @param to
   */
  async playlistMove(name: string, from: number, to: number): Promise<void> {
    this.sendCommand(`playlistmove ${name} ${from} ${to}`);
  }
  /**
   * Renames the playlist.
   * @param oldName Old name of the playlist
   * @param newName New name of the playlist
   */
  async playlistRename(oldName: string, newName: string): Promise<void> {
    this.sendCommand(`rename ${oldName} ${newName}`);
  }
  /**
   * Removes the playlist from the playliust directory
   * @param name Name of the playlist
   */
  async playlistRemove(name: string): Promise<void> {
    this.sendCommand(`rm ${name}`);
  }
  /**
   * Saves the current queue to the playlist directory
   * @param name The name of the playlist to save.
   */
  async playlistSave(name: string): Promise<void> {
    this.sendCommand(`save ${name}`);
  }
  // --- Music Database Commands ---

  /**
   * Locate album art for the given song and return a chunk of an album art image file at offset OFFSET.
   *
   * This is currently implemented by searching the directory the file resides in for a file called cover.png, cover.jpg, cover.tiff or cover.bmp.
   *
   * Returns the file size and actual number of bytes read at the requested offset, followed by the chunk requested as raw bytes (see Binary Responses), then a newline and the completion code.
   * @param uri URI of the song
   * @param offsets
   */
  async albumArt(
    uri: string,
    offsets: number = 0,
  ): Promise<BinaryResponse> {
    return this.sendCommandBinary(`albumart ${uri}`, offsets);
  }

  /**
   * Count the number of songs and their total playtime in the database matching FILTER (see {@link https://mpd.readthedocs.io/en/stable/protocol.html#filter-syntax|Filters}).
   * @param filter
   * @param group The group keyword may be used to group the results by a tag.
   */
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

  /**
   * Calculate the song’s audio fingerprint. Example (abbreviated fingerprint):
   *
   * This command is only available if MPD was built with `libchromaprint (-Dchromaprint=enabled)`.
   * @param uri
   */
  async getFingerPrint(uri: string): Promise<string> {
    return this.sendCommand(`getfingerprint ${uri}`);
  }

  /**
   * Search the database for songs matching FILTER (see {@link https://mpd.readthedocs.io/en/stable/protocol.html#filter-syntax|Filters}).
   * @param filter
   * @param options.sort Sort by tag.
   * @param options.window Query only a portion of the real response. The parameter is two zero-based record numbers; a start number and an end number.
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

  /**
   * Same as {@link find}, and add result to the queue
   * @param filter
   * @param options
   * @param options.position Add songs to position in queue
   */
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
  /**
   * Lists unique tags values of the specified type. TYPE can be any tag supported by MPD.
   * @param type
   * @param options
   * @example
   * //The following example lists all album names, grouped by their respective (album) artist
   * list("album", {group: "albumartist"})
   */
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

  /**
   * Lists all songs and directories in URI.
   *
   * Do not use this command. Do not manage a client-side copy of MPD’s database. That is fragile and adds huge overhead. It will break with large databases. Instead, query MPD whenever you need something.
   * @param uri
   * @deprecated
   * @returns
   */
  async listAll(uri: string) {
    return this.sendCommand(`listall ${uri}`);
  }

  /**
   * Same as listall, except it also returns metadata info in the same format as lsinfo
   *
   * Do not use this command. Do not manage a client-side copy of MPD’s database. That is fragile and adds huge overhead. It will break with large databases. Instead, query MPD whenever you need something.
   * @param uri
   * @deprecated
   */
  async listAllInfo(uri: string) {
    return this.sendCommand(`listallinfo ${uri}`);
  }

  /**
   * Lists the contents of the directory URI, including files are not recognized by MPD. URI can be a path relative to the music directory or an URI understood by one of the storage plugins. The response contains at least one line for each directory entry with the prefix “file: ” or “directory: “, and may be followed by file attributes such as “Last-Modified” and “size”.
   *
   * For example, “smb://SERVER” returns a list of all shares on the given SMB/CIFS server; “nfs://servername/path” obtains a directory listing from the NFS server.
   * @param uri
   */
  async listFiles(uri: string): Promise<string> {
    return this.sendCommand(`listfiles ${uri}`);
  }
  /**
   * Read “comments” (i.e. key-value pairs) from the file specified by “URI”. This “URI” can be a path relative to the music directory or an absolute path.
   *
   * This command may be used to list metadata of remote files (e.g. URI beginning with “http://” or “smb://”).
   *
   * The response consists of lines in the form “KEY: VALUE”. Comments with suspicious characters (e.g. newlines) are ignored silently.
   *
   * The meaning of these depends on the codec, and not all decoder plugins support it. For example, on Ogg files, this lists the Vorbis comments.
   * @param uri
   */
  async readComments(uri: string): Promise<string> {
    return this.sendCommand(`readcomments ${uri}`);
  }
  /**
   * Locate a picture for the given song and return a chunk of the image file at offset OFFSET. This is usually implemented by reading embedded pictures from binary tags (e.g. ID3v2’s APIC tag).
   *
   * Returns the following values:
   *
   * size: the total file size
   *
   * type: the file’s MIME type (optional)
   *
   * binary: see Binary Responses
   *
   * If the song file was recognized, but there is no picture, the response is successful, but is otherwise empty.
   * @param uri
   * @param offset
   */
  async readPicture(
    uri: string,
    offset: number = 0,
  ): Promise<BinaryResponse> {
    return this.sendCommandBinary(`readpicture "${uri}"`, offset);
  }
  /**
   * Search the database for songs matching FILTER  (see {@link https://mpd.readthedocs.io/en/stable/protocol.html#filter-syntax|Filters}).
   * Parameters have the same meaning as for {@link find}, except that search is not case sensitive.
   * @param filter
   * @param options
   */
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
  /**
   * Same as {@link search}, and add result to the queue
   * @param filter
   * @param options
   * @param options.position Add songs to position in queue
   */
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
  /**
   * Same as {@link search}, and add result to the playlist
   *
   * If a playlist by that name doesn’t exist it is created.
   * @param name Name of the playlist
   * @param filter
   * @param options
   * @param options.position Add songs to position in queue
   */
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
  /**
   * Updates the music database.
   * @param path (Optional) Path to update.
   * @returns Prints updating_db: JOBID where JOBID is a positive number identifying the update job. You can read the current job id in the status response.
   */
  async update(path?: string): Promise<string> {
    return this.sendCommand(`update ${path || ""}`);
  }
  /**
   * Updates and rescans the music database.
   * @param path (Optional) Path to rescan.
   */
  async rescan(path?: string): Promise<string> {
    return this.sendCommand(`rescan ${path || ""}`);
  }

  // --- Mounts and neighbors ---

  /**
   * Mount the specified remote storage URI at the given path
   * @param path
   * @param uri
   * @example
   * mount("foo", "nfs://192.168.1.4/export/mp3")
   */
  async mount(path: string, uri: string): Promise<void> {
    this.sendCommand(`mount ${path} ${uri}`);
  }
  /**
   * Unmounts the specified path.
   * @param path
   * @example
   * unmount("foo")
   */
  async unmount(path: string): Promise<void> {
    this.sendCommand(`mount ${path}`);
  }
  /**
   * Queries a list of all mounts. By default, this contains just the configured `music_directory`
   */
  async listMounts(): Promise<string> {
    return this.sendCommand(`listmounts`);
  }
  /**
   * Queries a list of “neighbors” (e.g. accessible file servers on the local net). Items on that list may be used with the mount command.
   */
  async listNeighbors(): Promise<string> {
    return this.sendCommand(`listneighbors`);
  }

  // --- Stickers ---

  /**
   * Adds a sticker to a song or directory.
   *
   * If a sticker item with that name already exists, it is replaced.
   * @param type The type (e.g., file or directory).
   * @param uri The URI of the file or directory.
   * @param name The sticker name.
   * @param value The sticker value.
   */
  async addSticker(
    type: string,
    uri: string,
    name: string,
    value: string,
  ): Promise<void> {
    this.sendCommand(`sticker set ${type} ${uri} ${name} ${value}`);
  }
  /**
   * Retrieves all stickers for a given URI.
   * @param type The type (e.g., file or directory).
   * @param uri The URI of the file or directory.
   */
  async getStickers(
    type: string,
    uri: string,
  ): Promise<string> {
    return this.sendCommand(`sticker get ${type} ${uri} ${name}`);
  }
  /**
   * Deletes a sticker.
   * @param type The type (e.g., file or directory).
   * @param uri The URI of the file or directory.
   * @param name Optional sticker name. If you do not specify a sticker name, all sticker values are deleted.
   */
  async deleteSticker(type: string, uri: string, name?: string): Promise<void> {
    this.sendCommand(`sticker delete ${type} ${uri} ${name}`);
  }
  /**
   * Searches the sticker database for stickers with the specified name, below the specified directory (URI).
   * For each matching song, it prints the URI and that one sticker’s value.
   * @param type
   * @param uri
   * @param name
   * @param value Optionally searches for stickers with the given value.
   * @param compare Sticker name-value compare method. Defaults to "="
   */
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

  /**
   * Lists the stickers for the specified object.
   * @param type
   * @param uri
   */
  async listStickers(type: string, uri: string): Promise<string> {
    return this.sendCommand(`sticker list ${type} ${uri}`);
  }

  // --- Connection settings ---
  /**
   * Closes the connection to MPD. MPD will try to send the remaining output buffer before it actually closes the connection, but that cannot be guaranteed. This command will not generate a response.
   *
   * Clients should not use this command; instead, they should just close the socket.
   */
  async close(): Promise<void> {
    this.sendCommand(`close`);
  }

  /**
   * Kills MPD.
   *
   * Do not use this command. Send SIGTERM to MPD instead, or better: let your service manager handle MPD shutdown (e.g. systemctl stop mpd).
   * @deprecated
   */
  async kill(): Promise<void> {
    this.sendCommand(`kill`);
  }
  /**
   * This is used for authentication with the server. PASSWORD is simply the plaintext password.
   * @param password
   */
  async password(password: string): Promise<void> {
    this.sendCommand(`password ${password}`);
  }
  /**
   * Does nothing but return “OK”.
   * @returns "OK"
   */
  async ping(): Promise<string> {
    const result = await this.sendCommand("ping");
    return handleError(result);
  }
  /**
   * Set the maximum binary {@link https://mpd.readthedocs.io/en/stable/protocol.html#binary|response size} for the current connection to the specified number of bytes.
   *
   * A bigger value means less overhead for transmitting large entities, but it also means that the connection is blocked for a longer time.
   * @param size
   */
  async binaryLimit(size: number): Promise<void> {
    this.sendCommand(`binarylimit ${size}`);
  }
  /**
   * Shows a list of available tag types. It is an intersection of the metadata_to_use setting and this client’s tag mask.
   *
   * About the tag mask: each client can decide to disable any number of tag types, which will be omitted from responses to this client.
   * That is a good idea, because it makes responses smaller. The following tagtypes sub commands configure this list.
   */
  async tagTypes(): Promise<string> {
    return this.sendCommand(`tagtypes`);
  }
  /**
   * Disable one or more tags from the list of tag types the client is interested in. These will be omitted from responses to this client.
   * @param tags
   */
  async tagTypesDisable(...tags: string[]): Promise<void> {
    this.sendCommand(`tagtypes disable ${tags.join(" ")}`);
  }
  /**
   * Re-enable one or more tags from the list of tag types for this client. These will no longer be hidden from responses to this client.
   * @param tags
   */
  async tagTypesEnable(...tags: string[]): Promise<void> {
    this.sendCommand(`tagtypes enable ${tags.join(" ")}`);
  }
  /**
   * Clear the list of tag types this client is interested in. This means that MPD will not send any tags to this client.
   */
  async tagTypesClear(): Promise<void> {
    this.sendCommand(`tagtypes clear`);
  }
  /**
   * Announce that this client is interested in all tag types. This is the default setting for new clients.
   */
  async tagTypesAll(): Promise<void> {
    this.sendCommand(`tagtypes all`);
  }

  // --- Partition commands ---

  /**
   * Switch the client to a different partition.
   * @param name
   */
  async partition(name: string): Promise<void> {
    this.sendCommand(`partition ${name}`);
  }
  /**
   * Print a list of partitions. Each partition starts with a `partition` keyword and the partition’s name, followed by information about the partition.
   */
  async listPartitions(): Promise<string> {
    return this.sendCommand(`listpartitions`);
  }
  /**
   * Create a new partition.
   * @param name
   */
  async newPartition(name: string): Promise<void> {
    this.sendCommand(`newpartition ${name}`);
  }
  /**
   * Delete a partition. The partition must be empty (no connected clients and no outputs).
   * @param name
   */
  async deletePartition(name: string): Promise<void> {
    this.sendCommand(`delpartition ${name}`);
  }
  /**
   * Move an output to the current partition.
   */
  async moveOutput(outputName: string): Promise<void> {
    this.sendCommand(`moveoutput ${outputName}`);
  }

  // --- Audio Output ---

  /**
   * Shows information about all outputs.
   */
  async listOutputs(): Promise<string> {
    return this.sendCommand(`outputs`);
  }
  /**
   * Enables a specific audio output.
   * @param id The ID of the audio output.
   */
  async enableOutput(id: number): Promise<void> {
    this.sendCommand(`enableoutput ${id}`);
  }
  /**
   * Disables a specific audio output.
   * @param id The ID of the audio output.
   */
  async disableOutput(id: number): Promise<void> {
    this.sendCommand(`disableoutput ${id}`);
  }
  /**
   * Turns an output on or off, depending on the current state.
   * @param id
   */
  async toggleOutput(id: number): Promise<void> {
    this.sendCommand(`toggleoutput ${id}`);
  }
  /**
   * Set a runtime attribute. These are specific to the output plugin, and supported values are usually printed in the {@link https://mpd.readthedocs.io/en/stable/protocol.html#command-outputs|outputs} response.
   * @param id
   * @param name
   * @param value
   */
  async outputSet(id: number, name: string, value: string): Promise<string> {
    return this.sendCommand(`outputset ${id} ${name} ${value}`);
  }

  // --- Reflection ---

  /**
   * Dumps configuration values that may be interesting for the client. This command is only permitted to “local” clients (connected via local socket).
   *
   * The following response attributes are available:
   *    music_directory: The absolute path of the music directory.
   */
  async config(): Promise<string> {
    return this.sendCommand(`config`);
  }
  /**
   * Shows which commands the current user has access to.
   */
  async commands(): Promise<string> {
    return this.sendCommand(`commands`);
  }
  /**
   * Shows which commands the current user does not have access to.
   */
  async notCommands(): Promise<string> {
    return this.sendCommand(`notcommands`);
  }
  /**
   * Gets a list of available URL handlers.
   */
  async urlHandlers(): Promise<string> {
    return this.sendCommand(`urlhandlers`);
  }
  /**
   * Print a list of decoder plugins, followed by their supported suffixes and MIME types.
   */
  async decoders(): Promise<string> {
    return this.sendCommand(`decoders`);
  }

  // --- Client to client

  /**
   * Subscribe to a channel. The channel is created if it does not exist already.
   * The name may consist of alphanumeric ASCII characters plus underscore, dash, dot and colon.
   * @param name
   */
  async subscribe(name: string): Promise<void> {
    this.sendCommand(`subscribe ${name}`);
  }
  /**
   * Unsubscribe from a channel.
   * @param name
   */
  async unsubscribe(name: string): Promise<void> {
    this.sendCommand(`unsubscribe ${name}`);
  }
  /**
   * Obtain a list of all channels. The response is a list of “channel:” lines.
   */
  async channels(): Promise<string> {
    return this.sendCommand(`channels`);
  }
  /**
   * Reads messages for this client. The response is a list of “channel:” and “message:” lines.
   */
  async readMessages(): Promise<string> {
    return this.sendCommand(`readmessages`);
  }
  /**
   * Send a message to the specified channel.
   * @param channel
   * @param text
   */
  async sendMessage(channel: string, text: string): Promise<void> {
    this.sendCommand(`sendmessage ${channel} ${text}`);
  }

  // --- Other Commands ---
  /**
   * Execute command list call with passed values as commands
   */
  async commandList(...commands: string[]): Promise<string> {
    const msgList = ["command_list_begin", ...commands, "command_list_end"];
    const msg = msgList.join("\n");
    const result = await this.sendCommand(msg);
    return handleError(result);
  }

  /**
   * Execute command list ok call with passed values as commands
   */
  async commandListOK(
    ...commands: string[]
  ): Promise<string> {
    const msgList = ["command_list_ok_begin", ...commands, "command_list_end"];
    const msg = msgList.join("\n");
    const result = await this.sendCommand(msg);
    return handleError(result);
  }

  async playlistinfo(): Promise<string> {
    const result = await this.sendCommand("playlistinfo");
    return handleError(result);
  }

  /**
   * Send command to MPD and returns response as string
   * @param message Message to send
   */
  async sendCommand(
    message: string,
  ): Promise<string> {
    if (this.idling) {
      const idleConnection = await this.#conn.connect(this.#host, this.#port);
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

  /**
   * Send command and returns response as meta and binary
   * @param message Message to send
   * @param offset Chunck offset. Defaults to 0
   * @returns {@type BinaryResponse} Binary with metadata
   */
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
}
