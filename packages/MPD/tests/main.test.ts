// deno-lint-ignore-file require-await no-explicit-any
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { type Spy, spy } from "jsr:@std/testing/mock";
import { MPDClient } from "../main.ts";

import type { TCPConnection } from "../utils.ts";
import {
  assertEquals,
  assertInstanceOf,
  assertObjectMatch,
  assertRejects,
} from "@std/assert";
import { ACKError } from "../mpd.ts";

let closeSpy = spy(() => {});
let readBinarySpy = spy(async (_buffer: string, _i?: boolean) =>
  new Uint8Array()
);
let readAllSpy = spy(async () => "");

class MockTCPClient implements TCPConnection {
  sendBinaryCommand = readBinarySpy;
  sendCommand = readAllSpy;
  close = closeSpy;
  #connection: Deno.TcpConn;
  constructor(connection: Deno.TcpConn) {
    this.#connection = connection;
  }
  static async connect(_host: string, _port: number) {
    return new MockTCPClient({} as any);
  }
}

let connectionSpy = spy(MockTCPClient);

const assertSpyConnectArgs = (
  spy: Spy,
  callIndex: number,
  expectedArgs: string[],
) => {
  const args = spy.calls[callIndex].args;
  assertEquals(args.length, expectedArgs.length);
  for (let i = 0; i < args.length; i++) {
    assertEquals(args[i], expectedArgs[i]);
  }
};

beforeEach(() => {
  connectionSpy = spy(connectionSpy.original);
  readAllSpy = spy(readAllSpy.original);
  closeSpy = spy(closeSpy.original);
});

const createClient = async () => {
  return MPDClient.init(MockTCPClient, "localhost", 6600);
};

describe("MPD class tests", () => {
  it("should be able to connect to the server", async () => {
    const client = await createClient();
    assertInstanceOf(client, MPDClient);
  });
  it("should be able to send a message", async () => {
    const client = await createClient();
    const input = "custom command\n";
    await client.mpd.sendCommand("custom command");
    assertSpyConnectArgs(readAllSpy, 0, [input]);
  });
  it("should be able get current song info", async () => {
    const client = await createClient();
    const input = "currentsong\n";
    await client.mpd.currentSong();
    assertSpyConnectArgs(readAllSpy, 0, [input]);
  });

  it("should be able get status info", async () => {
    const client = await createClient();
    const input = "status\n";
    await client.mpd.status();
    assertSpyConnectArgs(readAllSpy, 0, [input]);
  });
  it("should be able get stats info", async () => {
    const client = await createClient();
    const input = "stats\n";
    await client.mpd.stats();
    assertSpyConnectArgs(readAllSpy, 0, [input]);
  });
  it("should be able to make a find request", async () => {
    const client = await createClient();
    const input = "find \"(track == 'some song')\" sort -date window 0:10\n";

    await client.mpd.find({ tag: "track", value: "some song" }, {
      sort: {
        tag: "date",
        descending: true,
      },
      window: [0, 10],
    });
    assertSpyConnectArgs(readAllSpy, 0, [input]);
  });
  it("should be able to make a list request", async () => {
    const client = await createClient();
    const input = "list album \"(artist == 'some artist')\"\n";

    await client.mpd.list("album", {
      filter: {
        tag: "artist",
        value: "some artist",
      },
    });
    assertSpyConnectArgs(readAllSpy, 0, [input]);
  });
  it("should be able to make a list request with group", async () => {
    const client = await createClient();
    const input = "list album \"(artist == 'some artist')\" group composer\n";

    await client.mpd.list("album", {
      filter: {
        tag: "artist",
        value: "some artist",
      },
      group: "composer",
    });
    assertSpyConnectArgs(readAllSpy, 0, [input]);
  });
  describe("Error handling", () => {
    it("should throw an error if the result is an ACK", async () => {
      readAllSpy = spy(
        async () => "ACK some error\n",
      );
      const client = await createClient();
      const error = await assertRejects(
        () => client.mpd.status(),
        "Should throw an ACKError",
      );
      assertInstanceOf(error, ACKError);
      assertEquals(error.message, "ACK some error\n");
    });
  });
});
describe("MPDClient class tests", () => {
  /*
  it("should list playlists", async () => {
    unimplemented();
  });
  it("should list playlist tracks", async () => {
    unimplemented();
  });
  it("should be able to find a track", async () => {
    unimplemented();
  });
  it("should be able to find tracks by artist", async () => {
    unimplemented();
  });
  it("should be able to find albums by artist", async () => {
    unimplemented();
  });
  it("should be able to find tracks by composer", async () => {
    unimplemented();
  });
  it("should be able to find tracks by performer", async () => {
    unimplemented();
  });
  it("should be able to find tracks by album", async () => {
    unimplemented();
  });
  it("should be abel to play track at index", async () => {
    unimplemented();
  });
  it("should be abel to play track by id", async () => {
    unimplemented();
  });
  it("should be abel to go to time at track", async () => {
    unimplemented();
  });
  it("should be able to stop playing", async () => {
    unimplemented();
  });
  */
  it("should be able to list queue", async () => {
    readAllSpy = spy(
      async () => "file: file1\nTrack: 1\n\nfile: file2\nTrack: 2\n\n",
    );

    const client = await createClient();
    const input = "playlistinfo\n";
    const data = await client.queue();
    assertSpyConnectArgs(readAllSpy, 0, [input]);
    assertEquals(data.length, 2);
    assertObjectMatch(data[0], { file: "file1", Track: 1 });
    assertObjectMatch(data[1], { file: "file2", Track: 2 });
  });
  it("sould be able to clear queue", async () => {
    const client = await createClient();
    const input = "clear\n";
    await client.clearQueue();
    assertSpyConnectArgs(readAllSpy, 0, [input]);
  });
  it("should be able to add a track to the queue", async () => {
    const client = await createClient();
    await client.addToQueue({ uri: "file1" });
    const input = "add file1\n";
    assertSpyConnectArgs(readAllSpy, 1, [input]);
  });
  it("should be able to add a track to the queue with filter", async () => {
    const client = await createClient();
    await client.addToQueue({ filter: { tag: "track", value: "track1" } });
    const input = "findadd \"(track == 'track1')\"\n";
    assertSpyConnectArgs(readAllSpy, 1, [input]);
  });
  it("should be able to add album to the queue", async () => {
    const client = await createClient();
    await client.addAlbumToQueue("album1");
    const getCurrPlaylist = "playlistinfo\n";

    const input = "findadd \"(album == 'album1')\"\n";
    assertSpyConnectArgs(readAllSpy, 0, [getCurrPlaylist]);
    assertSpyConnectArgs(readAllSpy, 1, [input]);
  });
  it("should be able to add album to the queue", async () => {
    const client = await createClient();
    await client.addAlbumToQueue("album1", "artist1");
    const getCurrPlaylist = "playlistinfo\n";

    const input =
      "findadd \"(album == 'album1')\" \"(albumartist == 'artist1')\"\n";

    assertSpyConnectArgs(readAllSpy, 0, [getCurrPlaylist]);
    assertSpyConnectArgs(readAllSpy, 1, [input]);
  });
  /*it("should be able to add songs by artist to the queue", async () => {
    unimplemented();
  });
  it("should be able to add songs by composer to the queue", async () => {
    unimplemented();
  });
  it("should be able to go to next track in queue", async () => {
    unimplemented();
  });
  it("should be able to go to previous track in queue", async () => {
    unimplemented();
  });
  it("should be able to shuffle the queue", async () => {
    unimplemented();
  });
  it("should be able to clear the queue", async () => {
    unimplemented();
  });
  */
});
