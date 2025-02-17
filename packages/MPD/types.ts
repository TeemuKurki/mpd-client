export type FilterCompareMethod =
  | "=="
  | "!="
  | "contains"
  | "!contains"
  | "starts_with"
  | "=~"
  | "!~";

//TODO: Enable non-tag based filters (ie. audioFormat, prio etc)
//TODO: Enable negate option
/**
 * MPD Filter
 */
export type Filter = {
  tag: Tag;
  value: string;
  /**
   * @param {string} [compare="=="] Filter compare expression method. See possible methods {@link https://mpd.readthedocs.io/en/latest/protocol.html#filters}
   */
  compare?: FilterCompareMethod;
};

/**
 * MPD Range
 */
export type Range = [start: number, end: number];
/**
 * Response with binary data as Uint8Array and meta data
 */
export type BinaryResponse = {
  meta: {
    type?: string;
    size: number;
  };
  binary: Uint8Array;
};

/**
 * Any Filter type
 */
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
