import { describe, it, beforeEach } from "jsr:@std/testing/bdd";
import { spy, assertSpyCall } from "jsr:@std/testing/mock";
import { MPDClient } from "./main.ts";
import type { TCPConnection } from "./utils.ts";
import {
  assert,
  assertEquals,
  assertInstanceOf,
  AssertionError,
  assertRejects,
  unimplemented,
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
    assertSpyCall(connectionSpy, 0, { args: ["localhost", 6600] });
    assertInstanceOf(client, MPDClient);
  });
  it("should be able to send a message", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("custom message\n");
    await client.mpd.sendMessage("custom message");
    assertSpyCall(writeSpy, 0, { args: [input] });
  });
  it("should be able get current song info", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("currentsong\n");
    await client.mpd.currentSong();
    assertSpyCall(writeSpy, 0, { args: [input] });
  });

  it("should be able get status info", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("status\n");
    await client.mpd.status();
    assertSpyCall(writeSpy, 0, { args: [input] });
  });
  it("should be able get stats info", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("stats\n");
    await client.mpd.stats();
    assertSpyCall(writeSpy, 0, { args: [input] });
  });
  it("should be able to make a find request", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode(
      "find track some song sort -date window 0:10\n"
    );
    await client.mpd.find({
      filter: {
        tag: "track",
        value: "some song",
      },
      sort: "-date",
      window: [0, 10],
    });
    assertSpyCall(writeSpy, 0, { args: [input] });
  });
  it("should be able to make a list request", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("list album artist some artist\n");
    await client.mpd.list({
      type: "album",
      filter: {
        tag: "artist",
        value: "some artist",
      },
    });
    assertSpyCall(writeSpy, 0, { args: [input] });
  });
  it("should be able to make a list request with group", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode(
      "list album artist some artist group composer\n"
    );
    await client.mpd.list({
      type: "album",
      filter: {
        tag: "artist",
        value: "some artist",
      },
      group: "composer",
    });
    assertSpyCall(writeSpy, 0, { args: [input] });
  });
  describe("Error handling", () => {
    it("should throw an error if not connected", async () => {
      const client = await MPDClient.connect();
      client.disconnect();
      const error = await assertRejects(
        () => client.mpd.currentSong(),
        "Should throw an error"
      );
      assert(error instanceof AssertionError);
      assertEquals(error.message, "Not connected to MPD");
    });
    it("should throw an error if the result is an ACK", async () => {
      readAllSpy = spy(async () => "ACK some error\n");
      const client = await MPDClient.connect("localhost", 6600, connectionSpy);
      const error = await assertRejects(
        () => client.mpd.status(),
        "Should throw an ACKError"
      );
      assertInstanceOf(error, ACKError);
      assertEquals(error.message, "ACK some error\n");
    });
  });
});
describe("MPDClient class tests", () => {
  it("should be able to connect to the server", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    assertSpyCall(connectionSpy, 0, { args: ["localhost", 6600] });
    assertInstanceOf(client, MPDClient);
  });
  it("should be able to pause playback", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("pause 1\n");
    await client.pause(true);
    assertSpyCall(writeSpy, 0, { args: [input] });
  });
  it("should be able to resume playback", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("pause 0\n");
    await client.pause(false);
    assertSpyCall(writeSpy, 0, { args: [input] });
  });
  it("should be able to toggle playback", async () => {
    const client = await MPDClient.connect("localhost", 6600, connectionSpy);
    const input = new TextEncoder().encode("pause\n");
    await client.pause();
    assertSpyCall(writeSpy, 0, { args: [input] });
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
  it("should be able to add a track to the queue", async () => {
    unimplemented();
  });
  it("shuld be able to add album to the queue", async () => {
    unimplemented();
  });
  it("should be able to add songs by artist to the queue", async () => {
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

  describe("Error handling", () => {
    it("should throw an error if not connected", async () => {
      const client = await MPDClient.connect();
      client.disconnect();
      const error = await assertRejects(
        () => client.pause(),
        "Should throw an error"
      );
      assert(error instanceof AssertionError);
      assertEquals(error.message, "Not connected to MPD");
    });
  });
});
