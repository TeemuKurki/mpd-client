// deno-lint-ignore-file no-explicit-any
import type {
  ResolvedTransformer,
  StatsTransformType,
  StatusTransformType,
  TrackTransformType,
} from "../src/types.ts";

type MPDTransformer = Record<string, (value: string) => unknown>;

function Bool(value: string): 0 | 1 {
  return value === "1" ? 1 : 0;
}

/**
 * Handle status MPD meta info
 */
export const StatusTransform: StatusTransformType = {
  partition: String,
  volume: Number,
  repeat: Bool,
  random: Bool,
  single: (value: string) => value === "1" ? 1 : value === "0" ? 0 : "oneshot",
  consume: Bool,
  playlist: Number,
  playlistlength: Number,
  state: String as (value: string) => "play" | "stop" | "pause",
  song: Number,
  songid: Number,
  nextsong: Number,
  nextsongid: Number,
  time: String,
  elapsed: Number,
  duration: Number,
  bitrate: Number,
  xfade: Number,
  mixrampdb: Number,
  mixrampdelay: Number,
  audio: String,
  updating_db: String,
  error: String,
} satisfies MPDTransformer;

/**
 * Handle stats MPD meta info
 */
export const StatsTransform: StatsTransformType = {
  artists: Number,
  albums: Number,
  songs: Number,
  uptime: Number,
  db_playtime: Number,
  db_update: Number,
  playtime: Number,
} satisfies MPDTransformer;

/**
 * Handle track MPD meta info
 */
export const TrackTransform: TrackTransformType = {
  file: String,
  Format: String,
  Album: String,
  Comment: String,
  Disc: Number,
  Track: Number,
  Title: String,
  Date: String,
  Artist: String,
  OriginalDate: String,
  MUSICBRAINZ_ALBUMID: String,
  MUSICBRAINZ_ALBUMARTISTID: String,
  MUSICBRAINZ_TRACKID: String,
  MUSICBRAINZ_ARTISTID: String,
  MUSICBRAINZ_RELEASETRACKID: String,
  AlbumArtist: String,
  AlbumArtistSort: String,
  Label: String,
  ArtistSort: String,
  Genre: Array,
  Time: Number,
  duration: Number,
  Composer: String,
  ComposerSort: String,
  Conductor: String,
  Performer: Array,
  Pos: Number,
  Id: Number,
} satisfies MPDTransformer;

/**
 * Split MPD Tag into key-value pair. Handle values with ':'
 * @param line MPD Tag line
 * @returns Tag as key value pair
 */
const getKeyVal = (line: string): [key: string, value: string] => {
  const separatorIndex = line.indexOf(":");
  return [
    line.substring(0, separatorIndex).trim(),
    line.substring(separatorIndex + 1).trim(),
  ];
};
/**
 * Parse MPD response with transformer
 * @param input MPD response
 * @param transformer Response transformer
 * @param allowUnknownKeys Include unknown keys
 * @returns Response object based on transformer
 */
export const parse = <T extends MPDTransformer>(
  input: string,
  transformer: T,
  allowUnknownKeys = false,
): ResolvedTransformer<T> => {
  return input
    .split("\n")
    .filter((line) => line.includes(": "))
    .reduce((acc, line) => {
      const [key, value] = line.split(": ");
      if (key in transformer) {
        const transform = transformer[key as keyof typeof transformer];
        const val = transform(value);
        if (Array.isArray(val) && key in acc) {
          const prev = acc[key] as Array<unknown>;
          return {
            ...acc,
            [key]: [...prev, ...val],
          };
        }
        return { ...acc, [key]: val };
      } else if (allowUnknownKeys) {
        return { ...acc, [key]: value };
      }
      return acc;
    }, {} as ResolvedTransformer<T>);
};

/**
 * Parse response into plain object
 * @param input MPD response
 * @returns Response transformed into plain object
 */
export const parseUnknown = (input: string): Record<string, string> => {
  return input
    .split("\n")
    .reduce((acc, line) => {
      if (line.startsWith("ACK ")) {
        return { ...acc, ACK_ERROR: line };
      } else if (line.includes(":")) {
        const [key, value] = getKeyVal(line);
        return { ...acc, [key]: value };
      }
      return { ...acc };
    }, {} as Record<string, string>);
};

/**
 * Parse response into list of plain object.
 * @param input String returned from MPD
 * @param separatorTag Tag to separate groups. If not set, defaults to the first key in the list
 * @returns List of plain objects
 */
export const parseUnknownList = (
  input: string,
  separatorTag?: string,
): Record<string, unknown>[] => {
  const result: Record<string, unknown>[] = [];
  let separator = separatorTag || "";
  input
    .split("\n")
    .filter((line) => line.includes(": "))
    .forEach((line, i) => {
      const [key, value] = getKeyVal(line);
      if (!separatorTag && i === 0) {
        separator = key;
      }

      if (key.toLowerCase() === separator.toLowerCase()) {
        result.push({
          [key]: value,
        });
      } else {
        const last = result.at(-1);

        if (last) {
          if (key in last) {
            const prev = last[key];
            last[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
          } else {
            last[key] = value;
          }
        }
      }
    });
  return result;
};

/**
 * Parse MPD response into a list of objects with transformer
 * @param input MPD response
 * @param transformer Response transformer
 * @param separatorTag Tag to separate groups. If not set, defaults to the first key in the list
 * @param allowUnknownKeys Include unknown keys
 * @returns List of transformed objects
 */
export const parseList = <T extends MPDTransformer>(
  input: string,
  transformer: T,
  separatorTag?: string,
  allowUnknownKeys = false,
): ResolvedTransformer<T>[] => {
  const result = parseUnknownList(input, separatorTag);
  return result.map((item) => {
    return Object.keys(item).reduce((acc, curr) => {
      if (curr in transformer) {
        const transform = transformer[curr];
        let data = transform(item[curr] as any);
        if (Array.isArray(data)) {
          data = data.flat();
        }
        return {
          ...acc,
          [curr]: data,
        };
      }
      if (allowUnknownKeys) {
        return {
          ...acc,
          [curr]: item[curr],
        };
      }
      return {
        ...acc,
      };
    }, {} as ResolvedTransformer<T>);
  });
};

/**
 * Group MPD responses
 * @param input MPD Response
 * @param groupBy Group tag
 * @returns
 */
export const parseUnknownGroup = (
  input: string,
  groupBy: string,
): { group: string; values: string[] }[] => {
  const res: { group: string; values: string[] }[] = [];
  input
    .split("\n")
    .filter((line) => line.includes(": "))
    .forEach((line) => {
      const [key, value] = getKeyVal(line);
      if (key.toLowerCase() === groupBy.toLowerCase()) {
        res.push({
          group: value,
          values: [],
        });
      } else {
        const last = res.at(-1);
        if (last) {
          last["values"].push(value);
        }
      }
    });
  return res;
};
