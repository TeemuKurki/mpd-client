type FilterCompareMethod =
  | "=="
  | "!="
  | "contains"
  | "!contains"
  | "starts_with"
  | "=~"
  | "!~";

//TODO: Enable non-tag based filters (ie. audioFormat, prio etc)
//TODO: Enable negate option
export type Filter = {
  tag: Tag;
  value: string;
  /**
   * @param {string} [compare="=="] Filter compare expression method. See possible methods {@link https://mpd.readthedocs.io/en/latest/protocol.html#filters}
   */
  compare?: FilterCompareMethod;
};

export type Range = [start: number, end: number];
export type BinaryResponse = {
  meta: string;
  binary: Uint8Array;
};

export type AnyFilter = Filter | Filter[] | string;

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

/**
 * Interface for all MPD protocol commands
 */
export interface MPDProtocol {
  // --- Status Commands ---
  /**
   * Clears the current error message in status (this is also accomplished by any command that starts playback).
   */
  clearError(): Promise<void>;

  /**
   * Displays the current song in the playlist.
   */
  currentSong(): Promise<string>;

  /**
   * Waits until there is a noteworthy change in one or more of MPD’s subsystems.
   * @param subsystems See: {@link https://mpd.readthedocs.io/en/stable/protocol.html#command-idle|MPD subsystems}
   */
  idle(...subsystems: string[]): Promise<string>;

  /**
   * Displays the current status of the player.
   */
  status(): Promise<string>;

  /**
   * Shows statistics about the database.
   */
  stats(): Promise<string>;

  // --- Playback Options ---

  /**
   * Sets consume state to STATE, STATE should be 0, 1. When consume is activated, each song played is removed from playlist.
   * @param state
   */
  consume(state: 1 | 0): Promise<void>;

  /**
   * Sets crossfading between songs. {@link https://mpd.readthedocs.io/en/stable/user.html#crossfading|Cross-Fading}
   * @param seconds
   */
  crossfade(seconds: number): Promise<string>;

  /**
   * Sets the threshold at which songs will be overlapped. See {@link https://mpd.readthedocs.io/en/stable/user.html#mixramp|MixRamp}.
   * @param deciBels
   */
  mixrampdb(deciBels: number): Promise<string>;

  /**
   * Additional time subtracted from the overlap calculated by mixrampdb. A value of “nan” disables MixRamp overlapping and falls back to crossfading. See {@link https://mpd.readthedocs.io/en/stable/user.html#mixramp|MixRamp}.
   * @param seconds
   */
  mixrampdelay(seconds: number): Promise<string>;

  /**
   * Sets random state to STATE, STATE should be 0 or 1.
   * @param state
   */
  random(state: 1 | 0): Promise<void>;

  /**
   * Sets repeat state to STATE, STATE should be 0 or 1.
   *
   * If enabled, MPD keeps repeating the whole queue ({@link https://mpd.readthedocs.io/en/stable/protocol.html#command-single|single mode} disabled) or the current song ({@link https://mpd.readthedocs.io/en/stable/protocol.html#command-single|single mode} enabled).
   *
   * If {@link https://mpd.readthedocs.io/en/stable/protocol.html#command-random|random mode} is also enabled, the playback order will be shuffled each time the queue gets repeated.
   *
   * @param state
   */
  repeat(state: 1 | 0): Promise<void>;

  /**
   * Sets volume (0-100).
   * @param volume The desired volume level (0-100).
   */
  setVolume(volume: number): Promise<void>;

  /**
   * Read the volume. The result is a `volume:` line like in {@link https://mpd.readthedocs.io/en/stable/protocol.html#command-status|status}. If there is no mixer, MPD will emit an empty response.
   */
  getVolume(): Promise<string>;

  /**
   * Sets single state to `STATE`, `STATE` should be 0, 1 or oneshot. When single is activated, playback is stopped after current song, or song is repeated if the ‘repeat’ mode is enabled.
   * @param state
   */
  single(state: 1 | 0 | "oneshot"): Promise<void>;

  /**
   * Sets the replay gain mode. One of off, track, album, auto . Changing the mode during playback may take several seconds, because the new settings do not affect the buffered data. This command triggers the options idle event.
   * @param mode
   */
  replay_gain_mode(mode: "off" | "track" | "album" | "auto"): Promise<void>;

  /**
   * Prints replay gain options. Currently, only the variable `replay_gain_mode` is returned.
   */
  replay_gain_status(): Promise<string>;

  // --- Playback Controls ---

  /**
   * Plays next song in the playlist.
   */
  next(): Promise<void>;

  /**
   * Pause or resume playback. Pass `1` to pause playback or `0` to resume playback. Without the parameter, the pause state is toggled.
   * @param state `1` to pause, `0` to resume, undefined for toggle.
   */
  pause(state?: 1 | 0): Promise<void>;

  /**
   * Begins playing the playlist at song number `SONGPOS`.
   * @param SONGPOS
   */
  play(SONGPOS: number): Promise<void>;

  /**
   * Begins playing the playlist at song SONGID.
   * @param SONGID
   */
  playId(SONGID: string): Promise<void>;

  /**
   * Returns to the previous song in the playlist.
   */
  previous(): Promise<void>;

  /**
   * Seeks to the position TIME (in seconds; fractions allowed) of entry SONGPOS in the playlist.
   * @param SONGPOS Song position in playlist
   * @param TIME The position to seek to (in seconds).
   */
  seek(SONGPOS: number, TIME: number): Promise<void>;

  /**
   * Seeks to the position TIME (in seconds; fractions allowed) of song SONGID.
   * @param SONGID Song id in playlist
   * @param TIME The position to seek to (in seconds).
   */
  seekId(SONGID: string, TIME: number): Promise<void>;

  /**
   * Seeks to the position TIME (in seconds; fractions allowed) within the current song. If 'relative' set to + or -, then the time is relative to the current playing position.
   * @param TIME The position to seek to (in seconds).
   * @param relative set to + or -, then the time is relative to the current playing position.
   */
  seekCur(TIME: number, relative?: "+" | "-"): Promise<void>;

  /**
   * Stops playing.
   */
  stop(): Promise<void>;

  // --- Queue Management ---

  /**
   * Adds the file URI to the playlist (directories add recursively). URI can also be a single file.
   * @param uri The URI of the song to add.
   */
  add(uri: string): Promise<void>;

  /**
   * Adds a song to the playlist (non-recursive) and returns the song id. URI is always a single file or URL.
   * @param uri The URI of the song to add.
   * @param position If given, then the song is inserted at the specified position.
   * @param relative If given, then position is relative to current song.
   * @example
   * addId("/path/to/song.flac", 0, "+") //Sets song right after current song
   */
  addId(uri: string, position?: number, relative?: "+" | "-"): Promise<string>;

  /**
   * Clears the queue.
   */
  clear(): Promise<void>;

  /**
   * Deletes a song from the playlist.
   * @param position The position of the song to delete.
   */
  delete(position: number | Range): Promise<void>;

  /**
   * Deletes a song `songid` from the playlist.
   */
  deleteId(songid: number): Promise<void>;

  /**
   * Moves a song to a different position in the playlist.
   * @param from The current position of the song(s).
   * @param to The new position of the song(s).
   * @param relative If given, ´to´ is relative to the current song. If ´+´ add after current song, or if ´-´ add before current song
   */
  move(
    from: number | Range,
    to: number,
    relative?: "+" | "-",
  ): Promise<void>;

  /**
   * Moves a song to a different position in the playlist.
   * @param from The current id of the song.
   * @param to The new position of the song. (playlist index)
   * @param relative If given, ´to´ is relative to the current song. If ´+´ add after current song, or if ´-´ add before current song
   */
  move(
    from: number,
    to: number,
    relative?: "+" | "-",
  ): Promise<void>;

  /**
   * Search the queue for songs matching FILTER (see {@link https://mpd.readthedocs.io/en/stable/protocol.html#filter-syntax|Filters}).
   * @param filter
   */
  playlistFind(filter: AnyFilter): Promise<string>;

  /**
   * Displays a list of songs in the playlist. `songid` is optional and specifies a single song to display info for.
   * @param songid
   */
  playlistId(songid?: string): Promise<string>;

  /**
   * Displays a list of all songs in the playlist, or if the optional argument is given, displays information only for the song `SONGPOS` or the range of songs `START:END`
   */
  playlistInfo(
    songpos?: number | Range,
  ): Promise<string>;

  /**
   * Search the queue for songs matching FILTER (see {@link https://mpd.readthedocs.io/en/stable/protocol.html#filter-syntax|Filters}). Parameters have the same meaning as for find, except that search is not case sensitive.
   * @param filter
   */
  playlistSearch(filter: AnyFilter): Promise<string>;

  /**
   * Displays changed songs currently in the playlist since `VERSION`. Start and end positions may be given to limit the output to changes in the given `range`.
   *
   * To detect songs that were deleted at the end of the playlist, use playlistlength returned by status command.
   */
  playlistChanges(
    version: string,
    range?: Range,
  ): Promise<string>;

  /**
   * Displays changed songs currently in the playlist since `VERSION`. This function only returns the position and the id of the changed song, not the complete metadata. This is more bandwidth efficient.
   *
   * To detect songs that were deleted at the end of the playlist, use playlistlength returned by status command.
   */
  playlistChangePosId(
    version: string,
    range?: Range,
  ): Promise<string>;

  /**
   * Set the priority of the specified songs. A higher priority means that it will be played first when “random” mode is enabled.
   * A priority is an integer between 0 and 255. The default priority of new songs is 0.
   * @param priority
   * @param range
   */
  prio(priority: number, ...range: Range[]): Promise<void>;

  /**
   * Set the priority of the specified songs. A higher priority means that it will be played first when “random” mode is enabled.
   * A priority is an integer between 0 and 255. The default priority of new songs is 0.
   *
   * @param priority
   * @param id ID of selected song
   */
  prioId(priority: number, ...id: number[]): Promise<void>;

  /**
   * Since MPD 0.19 Specifies the portion of the song that shall be played. START and END are offsets in seconds (fractional seconds allowed); both are optional.
   * Omitting both means "remove the range, play everything". A song that is currently playing cannot be manipulated this way.
   * @param id ID of the song
   * @param range Range of the song to be played. If undefind, range is removed
   */
  rangeId(id: number, range?: { start?: number; end?: number }): Promise<void>;

  /**
   * Shuffles the queue. START:END is optional and specifies a range of songs.
   * @param range
   */
  shuffle(range?: Range): Promise<void>;

  /**
   * Swaps the positions of two songs in the playlist.
   * @param pos1 The first position.
   * @param pos2 The second position.
   */
  swap(pos1: number, pos2: number): Promise<void>;

  /**
   * Swaps the positions of two songs in the playlist by ids.
   *
   * @param pos1 The first position.
   * @param pos2 The second position.
   */
  swapId(pos1: number, pos2: number): Promise<void>;

  /**
   * Adds a tag to the specified song. Editing song tags is only possible for remote songs.
   * This change is volatile: it may be overwritten by tags received from the server, and the data is gone when the song gets removed from the queue.
   * @param songId ID of the song
   * @param tag Name of the tag
   * @param value Value of the tag
   */
  addTagId(songId: number, tag: string, value: string): Promise<void>;

  /**
   * Removes tags from the specified song. If TAG is not specified, then all tag values will be removed.
   * Editing song tags is only possible for remote songs.
   * @param songId ID of the song
   * @param tag Name of the tag
   */
  clearTagId(songId: number, tag?: string): Promise<void>;

  // --- Stored Playlists ---
  /**
   * Lists the songs in the playlist
   * @param name Name of the playlist
   */
  listPlaylist(name: string): Promise<string>;

  /**
   * Lists the songs with metadata in the playlist
   * @param name Name of the playlist
   */
  listPlaylistinfo(name: string): Promise<string>;

  /**
   * Prints a list of the playlist directory. After each playlist name the server sends its last modification time as attribute “Last-Modified” in ISO 8601 format.
   * To avoid problems due to clock differences between clients and the server, clients should not compare this value with their local clock.
   */
  listPlaylists(): Promise<string>;

  /**
   * Loads a stored playlist.
   * @param name The name of the playlist to load.
   * @param range Range of the playlist to load. Set `{start: 0}` to load entire playlist to certain queue position
   * @param position Specifies where the songs will be inserted into the queue
   */
  loadPlaylist(
    name: string,
    range?: { start: number; end?: number },
    position?: number,
    relative?: "+" | "-",
  ): Promise<void>;

  /**
   * Adds URI to the playlist NAME.m3u. NAME.m3u will be created if it does not exist.
   * @param name Name of the playlist
   * @param uri URI
   * @param position specifies where the songs will be inserted into the playlist.
   */
  playlistAdd(name: string, uri: string, position?: number): Promise<void>;

  /**
   * Clears the playlist NAME.m3u.
   * @param name Name of the playlist
   */
  playlistClear(name: string): Promise<void>;

  /**
   * Deletes `SONGPOS` from the playlist `NAME`.m3u.
   * @param name Name of the playlist
   * @param songPos Position of range of selected songs
   */
  playlistDelete(
    name: string,
    songPos: number | Range,
  ): Promise<void>;

  /**
   * Moves the song at position FROM in the playlist NAME.m3u to the position TO.
   * @param name Name of the playlist
   * @param from
   * @param to
   */
  playlistMove(name: string, from: number, to: number): Promise<void>;

  /**
   * Renames the playlist.
   * @param oldName Old name of the playlist
   * @param newName New name of the playlist
   */
  playlistRename(oldName: string, newName: string): Promise<void>;

  /**
   * Removes the playlist from the playliust directory
   * @param name Name of the playlist
   */
  playlistRemove(name: string): Promise<void>;

  /**
   * Saves the current queue to the playlist directory
   * @param name The name of the playlist to save.
   */
  playlistSave(name: string): Promise<void>;

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
  albumArt(
    uri: string,
    offsets: number,
  ): Promise<BinaryResponse>;

  /**
   * Count the number of songs and their total playtime in the database matching FILTER (see {@link https://mpd.readthedocs.io/en/stable/protocol.html#filter-syntax|Filters}).
   * @param filter
   * @param group The group keyword may be used to group the results by a tag.
   */
  count(filter: AnyFilter, group?: Tag): Promise<string>;

  /**
   * Calculate the song’s audio fingerprint. Example (abbreviated fingerprint):
   *
   * This command is only available if MPD was built with `libchromaprint (-Dchromaprint=enabled)`.
   * @param uri
   */
  getFingerPrint(uri: string): Promise<string>;

  /**
   * Search the database for songs matching FILTER (see {@link https://mpd.readthedocs.io/en/stable/protocol.html#filter-syntax|Filters}).
   * @param filter
   * @param options.sort Sort by tag.
   * @param options.window Query only a portion of the real response. The parameter is two zero-based record numbers; a start number and an end number.
   */
  find(
    filter: AnyFilter,
    options?: {
      sort?: { tag: Tag; order?: "ASC" | "DEC" };
      window?: Range;
    },
  ): Promise<string>;

  /**
   * Same as {@link find}, and add result to the queue
   * @param filter
   * @param options
   * @param options.position Add songs to position in queue
   */
  findAdd(
    filter: AnyFilter,
    options?: {
      sort?: { tag: Tag; descending?: boolean };
      window?: Range;
      position?: number;
    },
  ): Promise<string>;

  /**
   * Lists unique tags values of the specified type. TYPE can be any tag supported by MPD.
   * @param type
   * @param options
   * @example
   * //The following example lists all album names, grouped by their respective (album) artist
   * list("album", {group: "albumartist"})
   */
  list(
    type: Tag,
    options?: { filter?: AnyFilter; group?: Tag },
  ): Promise<string>;

  /**
   * Lists the contents of the directory URI, including files are not recognized by MPD. URI can be a path relative to the music directory or an URI understood by one of the storage plugins. The response contains at least one line for each directory entry with the prefix “file: ” or “directory: “, and may be followed by file attributes such as “Last-Modified” and “size”.
   *
   * For example, “smb://SERVER” returns a list of all shares on the given SMB/CIFS server; “nfs://servername/path” obtains a directory listing from the NFS server.
   * @param uri
   */
  listFiles(uri: string): Promise<string>;

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
  readComments(uri: string): Promise<string>;

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
  readPicture(
    uri: string,
    offset: number,
  ): Promise<BinaryResponse>;

  /**
   * Search the database for songs matching FILTER  (see {@link https://mpd.readthedocs.io/en/stable/protocol.html#filter-syntax|Filters}).
   * Parameters have the same meaning as for {@link find}, except that search is not case sensitive.
   * @param filter
   * @param options
   */
  search(
    filter: AnyFilter,
    options?: {
      sort?: { tag: Tag; order?: "ASC" | "DEC" };
      window?: Range;
    },
  ): Promise<string>;

  /**
   * Same as {@link search}, and add result to the queue
   * @param filter
   * @param options
   * @param options.position Add songs to position in queue
   */
  searchAdd(filter: AnyFilter, options?: {
    sort?: { tag: Tag; order?: "ASC" | "DEC" };
    window?: Range;
    position?: number;
  }): Promise<string>;

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
      sort?: { tag: Tag; order?: "ASC" | "DEC" };
      window?: Range;
      position?: number;
    },
  ): Promise<string>;

  /**
   * Updates the music database.
   * @param path (Optional) Path to update.
   * @returns Prints updating_db: JOBID where JOBID is a positive number identifying the update job. You can read the current job id in the status response.
   */
  update(path?: string): Promise<string>;

  /**
   * Updates and rescans the music database.
   * @param path (Optional) Path to rescan.
   */
  rescan(path?: string): Promise<string>;

  // --- Mounts and neighbors ---
  /**
   * Mount the specified remote storage URI at the given path
   * @param path
   * @param uri
   * @example
   * mount("foo", "nfs://192.168.1.4/export/mp3")
   */
  mount(path: string, uri: string): Promise<void>;

  /**
   * Unmounts the specified path.
   * @param path
   * @example
   * unmount("foo")
   */
  unmount(path: string): Promise<void>;

  /**
   * Queries a list of all mounts. By default, this contains just the configured `music_directory`
   */
  listMounts(): Promise<string>;

  /**
   * Queries a list of “neighbors” (e.g. accessible file servers on the local net). Items on that list may be used with the mount command.
   */
  listNeighbors(): Promise<string>;

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
  addSticker(
    type: string,
    uri: string,
    name: string,
    value: string,
  ): Promise<void>;

  /**
   * Retrieves all stickers for a given URI.
   * @param type The type (e.g., file or directory).
   * @param uri The URI of the file or directory.
   */
  getStickers(type: string, uri: string): Promise<string>;

  /**
   * Deletes a sticker.
   * @param type The type (e.g., file or directory).
   * @param uri The URI of the file or directory.
   * @param name Optional sticker name. If you do not specify a sticker name, all sticker values are deleted.
   */
  deleteSticker(type: string, uri: string, name?: string): Promise<void>;

  /**
   * Searches the sticker database for stickers with the specified name, below the specified directory (URI).
   * For each matching song, it prints the URI and that one sticker’s value.
   * @param type
   * @param uri
   * @param name
   * @param value Optionally searches for stickers with the given value.
   * @param compare Sticker name-value compare method. Defaults to "="
   */
  findStickers(
    type: string,
    uri: string,
    name: string,
    value?: string,
    compare?: "=" | "<" | ">",
  ): Promise<string>;

  /**
   * Lists the stickers for the specified object.
   * @param type
   * @param uri
   */
  listStickers(
    type: string,
    uri: string,
  ): Promise<string>;

  // --- Connection settings ---
  /**
   * Disconnects from the MPD server.
   */
  close(): void;

  /**
   * Kills MPD.
   */
  kill(): Promise<void>;

  /**
   * This is used for authentication with the server. PASSWORD is simply the plaintext password.
   * @param password
   */
  password(password: string): Promise<void>;

  /**
   * Does nothing but return “OK”.
   */
  ping(): Promise<string>;

  /**
   * Set the maximum binary {@link https://mpd.readthedocs.io/en/stable/protocol.html#binary|response size} for the current connection to the specified number of bytes.
   *
   * A bigger value means less overhead for transmitting large entities, but it also means that the connection is blocked for a longer time.
   * @param size
   */
  binaryLimit(size: number): Promise<void>;

  /**
   * Shows a list of available tag types. It is an intersection of the metadata_to_use setting and this client’s tag mask.
   *
   * About the tag mask: each client can decide to disable any number of tag types, which will be omitted from responses to this client.
   * That is a good idea, because it makes responses smaller. The following tagtypes sub commands configure this list.
   */
  tagTypes(): Promise<string>;

  /**
   * Disable one or more tags from the list of tag types the client is interested in. These will be omitted from responses to this client.
   * @param tags
   */
  tagTypesDisable(...tags: string[]): Promise<void>;

  /**
   * Re-enable one or more tags from the list of tag types for this client. These will no longer be hidden from responses to this client.
   * @param tags
   */
  tagTypesEnable(...tags: string[]): Promise<void>;

  /**
   * Clear the list of tag types this client is interested in. This means that MPD will not send any tags to this client.
   */
  tagTypesClear(): Promise<void>;

  /**
   * Announce that this client is interested in all tag types. This is the default setting for new clients.
   */
  tagTypesAll(): Promise<void>;

  // --- Partition commands ---

  /**
   * Switch the client to a different partition.
   * @param name
   */
  partition(name: string): Promise<void>;

  /**
   * Print a list of partitions. Each partition starts with a `partition` keyword and the partition’s name, followed by information about the partition.
   */
  listPartitions(): Promise<string>;

  /**
   * Create a new partition.
   * @param name
   */
  newPartition(name: string): Promise<void>;

  /**
   * Delete a partition. The partition must be empty (no connected clients and no outputs).
   * @param name
   */
  deletePartition(name: string): Promise<void>;

  /**
   * Move an output to the current partition.
   */
  moveOutput(outputName: string): Promise<void>;

  // --- Audio Output ---
  /**
   * Shows information about all outputs.
   */
  listOutputs(): Promise<string>;

  /**
   * Enables a specific audio output.
   * @param id The ID of the audio output.
   */
  enableOutput(id: number): Promise<void>;

  /**
   * Disables a specific audio output.
   * @param id The ID of the audio output.
   */
  disableOutput(id: number): Promise<void>;

  /**
   * Turns an output on or off, depending on the current state.
   * @param id
   */
  toggleOutput(id: number): Promise<void>;

  /**
   * Set a runtime attribute. These are specific to the output plugin, and supported values are usually printed in the {@link https://mpd.readthedocs.io/en/stable/protocol.html#command-outputs|outputs} response.
   * @param id
   * @param name
   * @param value
   */
  outputSet(id: number, name: string, value: string): Promise<string>;

  // --- Reflection ---
  /**
   * Dumps configuration values that may be interesting for the client. This command is only permitted to “local” clients (connected via local socket).
   *
   * The following response attributes are available:
   *    music_directory: The absolute path of the music directory.
   */
  config(): Promise<string>;

  /**
   * Shows which commands the current user has access to.
   */
  commands(): Promise<string>;

  /**
   * Shows which commands the current user does not have access to.
   */
  notCommands(): Promise<string>;

  /**
   * Gets a list of available URL handlers.
   */
  urlHandlers(): Promise<string>;

  /**
   * Print a list of decoder plugins, followed by their supported suffixes and MIME types.
   */
  decoders(): Promise<string>;

  // --- Client to client

  /**
   * Subscribe to a channel. The channel is created if it does not exist already.
   * The name may consist of alphanumeric ASCII characters plus underscore, dash, dot and colon.
   * @param name
   */
  subscribe(name: string): Promise<void>;
  /**
   * Unsubscribe from a channel.
   * @param name
   */
  unsubscribe(name: string): Promise<void>;

  /**
   * Obtain a list of all channels. The response is a list of “channel:” lines.
   */
  channels(): Promise<string>;

  /**
   * Reads messages for this client. The response is a list of “channel:” and “message:” lines.
   */
  readMessages(): Promise<string>;

  /**
   * Send a message to the specified channel.
   * @param channel
   * @param text
   */
  sendMessage(channel: string, text: string): Promise<void>;

  // --- Other Commands ---
  /**
   * Send command to MPD and returns response as string
   * @param message Message to send
   */
  sendCommand(message: string): Promise<string>;

  /**
   * Send command to MPD and returns response as meta and binary
   * @param message Message to send
   * @returns Response with meta as text and binary content as Uint8Array
   */
  sendCommandBinary(
    message: string,
  ): Promise<BinaryResponse>;
}

export interface MPDClientInterface {
  queue(): Promise<Record<string, string>[]>;
  clearQueue(): Promise<void>;
  clearRestOfQueue(): Promise<void>;
  addToQueue(params: { filter?: AnyFilter; uri?: string }): Promise<void>;
  addAlbumToQueue(album: string, artist?: string): Promise<string>;
  listArtists(): Promise<string[]>;
  listAlbums(
    artist?: string,
  ): Promise<{ group: string; values: string[] }[]>;
  getTracks(album: string): Promise<Record<string, string>[]>;
  status(): Promise<Record<string, string>>;
  stats(): Promise<Record<string, string>>;
  info(): Promise<{
    currentSong: Record<string, string>;
    status: Record<string, string>;
    stats: Record<string, string>;
  }>;
  list(type: Tag, options?: {
    filter?: AnyFilter;
    group: Tag;
  }): Promise<{
    group: string;
    values: string[];
  }[]>;
  list(type: Tag, options?: {
    filter?: AnyFilter;
  }): Promise<Record<string, string>[]>;
  list(type: Tag, options?: {
    filter?: AnyFilter;
    group?: Tag;
  }): Promise<
    Record<string, string>[] | { group: string; values: string[] }[]
  >;
  currentSong(): Promise<Record<string, string>>;
  disconnect(): void;
}
