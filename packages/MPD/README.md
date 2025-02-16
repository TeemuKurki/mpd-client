# MPD Client for JavaScript

This documentation provides an overview of the MPD Client written in Deno. It
allows you to interface with an MPD (Music Player Daemon) server, enabling
control over music playback, querying the song queue, and managing the MPD
server.

## Overview

The MPD Client for Deno is a simple client that interacts with an MPD server
over a TCP socket. It is written in TypeScript using Deno, providing a modern,
secure environment to control music playback on MPD servers.

The client allows:

- Sending commands to MPD (e.g., play, pause, next, previous).
- Fetching current status and metadata about the music being played.
- Manipulating the song queue, adding or removing songs.

The client is designed to be runtime agnostic. To achieve this, we have to
separate TCP calls for the main MPD client.

## Usage

```javascript
import { TCPClient } from "@teemukurki/mpd-deno-client";
import { MPDClient } from "@teemukurki/mpd";

const MPD_HOST = "localhost";
const MPD_PORT = 6600;

const client = MPDClient.init(
  TCPClient,
  MPD_HOST,
  MPD_PORT,
);

const status = await client.status();
console.log(status);
```
