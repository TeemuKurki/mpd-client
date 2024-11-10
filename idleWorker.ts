import {connect} from "./utils.ts" 
import type { TCPConnection} from "./utils.ts" 

async function sendMessage(message: string, conn: TCPConnection): Promise<string> {
    await conn.write(new TextEncoder().encode(message + "\n"));
    return conn.readAll();
  }

self.onmessage = async (e) => {
    const {subsystems, host, port} = e.data;
    const conn = await connect(host, port);
    const res = await sendMessage("idle " + subsystems, conn)
    postMessage(res)
    self.close()
  };    