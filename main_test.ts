import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import {
  assertSpyCall,
  assertSpyCallArgs,
  type Spy,
  spy,
} from "jsr:@std/testing/mock";
import { MPDClient } from "./main.ts";
import type { TCPConnection } from "./utils.ts";
import {
  assert,
  assertEquals,
  assertInstanceOf,
  AssertionError,
  assertObjectMatch,
  assertRejects,
} from "@std/assert";
import { ACKError } from "./mpd.ts";

let closeSpy = spy(() => {});
let readSpy = spy(async (buffer: Uint8Array) => 0);
let readAllSpy = spy(async () => "");
let writeSpy = spy(async (data: Uint8Array) => 0);
const mockConnection = async (): Promise<TCPConnection> => {
  return {
    close: closeSpy,
    read: readSpy,
    readAll: readAllSpy,
    write: writeSpy,
  };
};

let connectionSpy = spy(mockConnection);

const assertSpyConnectArgs = (
  spy: Spy,
  callIndex: number,
  expectedArgs: Uint8Array[],
) => {
  const decoder = new TextDecoder();
  const args = spy.calls[callIndex].args;
  assertEquals(args.length, expectedArgs.length);
  for (let i = 0; i < args.length; i++) {
    assertEquals(decoder.decode(args[i]), decoder.decode(expectedArgs[i]));
  }
};

beforeEach(() => {
  connectionSpy = spy(connectionSpy.original);
  writeSpy = spy(writeSpy.original);
  readSpy = spy(readSpy.original);
  readAllSpy = spy(readAllSpy.original);
  closeSpy = spy(closeSpy.original);
});

describe("MPD class tests", () => {
  it("should be able to connect to the server", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    assertSpyCallArgs(connectionSpy, 0, ["localhost", 6600]);
    assertInstanceOf(client, MPDClient);
  });
  it("should be able to send a message", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("custom message\n");
    await client.mpd.sendMessage("custom message");
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  it("should be able get current song info", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("currentsong\n");
    await client.mpd.currentSong();
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });

  it("should be able get status info", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("status\n");
    await client.mpd.status();
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  it("should be able get stats info", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("stats\n");
    await client.mpd.stats();
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  it("should be able to make a find request", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode(
      "find \"(track == 'some song')\" sort -date window 0:10\n",
    );
    await client.mpd.find({
      filter: {
        tag: "track",
        value: "some song",
      },
      sort: "-date",
      window: [0, 10],
    });
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  it("should be able to make a list request", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode(
      "list album \"(artist == 'some artist')\"\n",
    );
    await client.mpd.list({
      type: "album",
      filter: {
        tag: "artist",
        value: "some artist",
      },
    });
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  it("should be able to make a list request with group", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode(
      "list album \"(artist == 'some artist')\" group composer\n",
    );
    await client.mpd.list({
      type: "album",
      filter: {
        tag: "artist",
        value: "some artist",
      },
      group: "composer",
    });
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  describe("Error handling", () => {
    it("should throw an error if not connected", async () => {
      const client = await MPDClient.connect("localhost", 6600, connectionSpy);
      client.disconnect();
      const error = await assertRejects(
        () => client.mpd.currentSong(),
        "Should throw an error",
      );
      assert(error instanceof AssertionError);
      assertEquals(error.message, "Not connected to MPD");
    });
    it("should throw an error if the result is an ACK", async () => {
      readAllSpy = spy(async () => "ACK some error\n");
      const client = await MPDClient.connect("localhost", 6600, connectionSpy);
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
  it("should be able to connect to the server", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    assertSpyCallArgs(connectionSpy, 0, ["localhost", 6600]);
    assertInstanceOf(client, MPDClient);
  });
  it("should be able to pause playback", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("pause 1\n");
    await client.pause(true);
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  it("should be able to resume playback", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("pause 0\n");
    await client.pause(false);
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  it("should be able to toggle playback", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("pause\n");
    await client.pause();
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  it("should be able to close the connection", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    client.disconnect();
    assertSpyCall(closeSpy, 0);
  });
  it("should be able to close the connection", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    client.disconnect();
    assertSpyCall(closeSpy, 0);
  });
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
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("playlistinfo\n");
    const data = await client.queue();
    assertSpyConnectArgs(writeSpy, 0, [input]);
    assertEquals(data.length, 2);
    assertObjectMatch(data[0], { file: "file1", Track: "1" });
    assertObjectMatch(data[1], { file: "file2", Track: "2" });
  });
  it("sould be able to clear queue", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("clear\n");
    await client.clearQueue();
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  it("should be able to add a track to the queue", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    await client.addToQueue({ uri: "file1" });
    const input = new TextEncoder().encode('add "file1"\n');
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  it("should be able to add a track to the queue with filter", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    await client.addToQueue({ filter: { tag: "track", value: "track1" } });
    const input = new TextEncoder().encode("findadd \"(track == 'track1')\"\n");
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  it("should be able to add album to the queue", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    await client.addAlbumToQueue("album1");
    const input = new TextEncoder().encode("findadd \"(album == 'album1')\"\n");
    assertSpyConnectArgs(writeSpy, 0, [input]);
  });
  it("should be able to add album to the queue", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    await client.addAlbumToQueue("album1", "artist1");
    const input = new TextEncoder().encode(
      "findadd \"(album == 'album1')\" \"(artist == 'artist1')\"\n",
    );
    assertSpyConnectArgs(writeSpy, 0, [input]);
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
  describe("Error handling", () => {
    it("should throw an error if not connected", async () => {
      const client = await MPDClient.connect("localhost", 6600, connectionSpy);
      client.disconnect();
      const error = await assertRejects(
        () => client.pause(),
        "Should throw an error",
      );
      assert(error instanceof AssertionError);
      assertEquals(error.message, "Not connected to MPD");
    });
  });
});
