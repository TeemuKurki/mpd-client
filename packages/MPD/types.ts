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
  meta: {
    type?: string;
    size: number;
  };
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

// -- Transformers --

export type Transformer = Record<string, (value: string) => any>;

type ConstructorToType<T> = T extends (value: string) => infer R ? R : string;

export type ResolvedTransformer<T> = {
  [K in keyof T]: ConstructorToType<T[K]>;
};
type Bool = 0 | 1;
type TransformerAttribute<T> = (value: string) => T;

export type StatusTransformType = {
  partition: TransformerAttribute<string>;
  volume: TransformerAttribute<number>;
  repeat: TransformerAttribute<Bool>;
  random: TransformerAttribute<Bool>;
  single: TransformerAttribute<Bool | "oneshot">;
  consume: TransformerAttribute<Bool>;
  playlist: TransformerAttribute<number>;
  playlistlength: TransformerAttribute<number>;
  state: TransformerAttribute<"play" | "stop" | "pause">;
  song: TransformerAttribute<number>;
  songid: TransformerAttribute<number>;
  nextsong: TransformerAttribute<number>;
  nextsongid: TransformerAttribute<number>;
  time: TransformerAttribute<string>;
  elapsed: TransformerAttribute<number>;
  duration: TransformerAttribute<number>;
  bitrate: TransformerAttribute<number>;
  xfade: TransformerAttribute<number>;
  mixrampdb: TransformerAttribute<number>;
  mixrampdelay: TransformerAttribute<number>;
  audio: TransformerAttribute<string>;
  updating_db: TransformerAttribute<string>;
  error: TransformerAttribute<string>;
};

export type StatsTransformType = {
  artists: TransformerAttribute<number>;
  albums: TransformerAttribute<number>;
  songs: TransformerAttribute<number>;
  uptime: TransformerAttribute<number>;
  db_playtime: TransformerAttribute<number>;
  db_update: TransformerAttribute<number>;
  playtime: TransformerAttribute<number>;
};

export type TrackTransformType = {
  file: TransformerAttribute<string>;
  Format: TransformerAttribute<string>;
  Album: TransformerAttribute<string>;
  Comment: TransformerAttribute<string>;
  Disc: TransformerAttribute<number>;
  Track: TransformerAttribute<number>;
  Title: TransformerAttribute<string>;
  Date: TransformerAttribute<string>;
  Artist: TransformerAttribute<string>;
  OriginalDate: TransformerAttribute<string>;
  MUSICBRAINZ_ALBUMID: TransformerAttribute<string>;
  MUSICBRAINZ_ALBUMARTISTID: TransformerAttribute<string>;
  MUSICBRAINZ_TRACKID: TransformerAttribute<string>;
  MUSICBRAINZ_ARTISTID: TransformerAttribute<string>;
  MUSICBRAINZ_RELEASETRACKID: TransformerAttribute<string>;
  AlbumArtist: TransformerAttribute<string>;
  AlbumArtistSort: TransformerAttribute<string>;
  Label: TransformerAttribute<string>;
  ArtistSort: TransformerAttribute<string>;
  Genre: TransformerAttribute<Array<string>>;
  Time: TransformerAttribute<number>;
  duration: TransformerAttribute<number>;
};
