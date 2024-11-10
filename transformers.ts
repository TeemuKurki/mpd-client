function Bool(value: string): 0 | 1 {
  return value === "1" ? 1 : 0;
}

type ConstructorToType<T> = T extends (value: string) => infer R ? R : string;

export type ResolvedTransformer<T> = {
  [K in keyof T]: ConstructorToType<T[K]>;
};

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
} satisfies Record<string, (value: string) => any>;

export const StatsTransform = {
  artists: Number,
  albums: Number,
  songs: Number,
  uptime: Number,
  db_playtime: Number,
  db_update: Number,
  playtime: Number,
} satisfies Record<string, (value: string) => any>;

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
        return { ...acc, [key]: transform(value) };
      } else if (allowUnknownKeys) {
        return { ...acc, [key]: value };
      }
      return acc;
    }, {} as ResolvedTransformer<T>);
};

export const parseUnknown = (input: string): Record<string, string> => {
  return input
    .split("\n")
    .filter((line) => line.includes(": "))
    .reduce((acc, line) => {
      const [key, value] = line.split(": ");
      return { ...acc, [key]: value };
    }, {} as Record<string, string>);
};

/**
 * @param input String returned from MPD
 * @param separatorTag Tag to separate groups. If not set, defaults to the first key in the list
 */
export const parseUnknownList = (
  input: string,
  separatorTag?: string,
): Record<string, string>[] => {
  const result: Record<string, string>[] = [];
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
          last[key] = value;
        }
      }
    });
  return result;
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
