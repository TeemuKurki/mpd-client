function Bool(value: string): 0 | 1 {
  return value === "1" ? 1 : 0;
}

type ConstructorToType<T> = T extends (value: string) => infer R ? R : string;

export type ResolvedTransformer<T> = {
  [K in keyof T]: ConstructorToType<T[K]>;
};

export type Transformer = Record<string, (value: string) => any>;

export const StatusTransform = {
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
  updating_db: Boolean,
  error: String,
} satisfies Transformer;

export const StatsTransform = {
  artists: Number,
  albums: Number,
  songs: Number,
  uptime: Number,
  db_playtime: Number,
  db_update: Number,
  playtime: Number,
} satisfies Transformer;

export const TrackTransform = {
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
  Genre: (input: string | string[]) => Array.isArray(input) ? input : [input],
  Time: Number,
  duration: Number,
} satisfies Transformer;

export const parse = <T extends Record<string, any>>(
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
            [key]: [...prev, val],
          };
        }
        return { ...acc, [key]: val };
      } else if (allowUnknownKeys) {
        return { ...acc, [key]: value };
      }
      return acc;
    }, {} as ResolvedTransformer<T>);
};

export const parseUnknown = (input: string): Record<string, string> => {
  return input
    .split("\n")
    .reduce((acc, line) => {
      if (line.startsWith("ACK ")) {
        return { ...acc, ACK_ERROR: line };
      } else if (line.includes(":")) {
        const [key, value] = line.split(": ");
        return { ...acc, [key]: value };
      }
      return { ...acc };
    }, {} as Record<string, string>);
};

/**
 * @param input String returned from MPD
 * @param separatorTag Tag to separate groups. If not set, defaults to the first key in the list
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
      const separatorIndex = line.indexOf(": ");
      const key = line.substring(0, separatorIndex);
      const value = line.substring(separatorIndex + 2);
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
export const parseList = <T extends Transformer>(
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
        return {
          ...acc,
          [curr]: transform(item[curr] as any),
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
export const parseUnknownGroup = (
  input: string,
  groupBy: string,
): { group: string; values: string[] }[] => {
  const res: { group: string; values: string[] }[] = [];
  input
    .split("\n")
    .filter((line) => line.includes(": "))
    .forEach((line) => {
      const separatorIndex = line.indexOf(": ");
      const key = line.substring(0, separatorIndex);
      const value = line.substring(separatorIndex + 2);
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
