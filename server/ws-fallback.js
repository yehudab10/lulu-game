// Minimal zero-dependency RFC6455 WebSocket server.
//
// Only used by local-relay.js as a fallback when the `ws` npm package is not
// installed. Implements just enough of the `ws` WebSocketServer surface that
// the relay relies on:
//   new WebSocketServer({ noServer: true })
//   wss.handleUpgrade(req, socket, head, cb)  -> cb(ws)
//   ws.on("message" | "close" | "error", fn)
//   ws.send(string)   ws.close(code, reason)
//
// Text frames only for app data (the protocol is JSON text). Handles ping,
// pong, close, and continuation frames; masks are required from clients.

const crypto = require("crypto");
const { EventEmitter } = require("events");

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_PAYLOAD = 16 * 1024; // generous; relay itself caps at 2 KB

function accept(key) {
  return crypto
    .createHash("sha1")
    .update(key + GUID)
    .digest("base64");
}

class FallbackSocket extends EventEmitter {
  constructor(socket) {
    super();
    this._socket = socket;
    this._closed = false;
    this._buf = Buffer.alloc(0);
    this._fragOpcode = 0;
    this._fragChunks = [];

    socket.on("data", (chunk) => this._onData(chunk));
    socket.on("close", () => this._finish());
    socket.on("error", (err) => {
      this.emit("error", err);
      this._finish();
    });
  }

  _onData(chunk) {
    this._buf = Buffer.concat([this._buf, chunk]);
    // Parse as many complete frames as are buffered.
    for (;;) {
      const frame = this._readFrame();
      if (!frame) break;
      this._handleFrame(frame);
    }
  }

  _readFrame() {
    const buf = this._buf;
    if (buf.length < 2) return null;
    const b0 = buf[0];
    const b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let offset = 2;

    if (len === 126) {
      if (buf.length < offset + 2) return null;
      len = buf.readUInt16BE(offset);
      offset += 2;
    } else if (len === 127) {
      if (buf.length < offset + 8) return null;
      const hi = buf.readUInt32BE(offset);
      const lo = buf.readUInt32BE(offset + 4);
      len = hi * 0x100000000 + lo;
      offset += 8;
    }
    if (len > MAX_PAYLOAD) {
      // oversized — drop the connection
      this.close(1009, "too big");
      this._buf = Buffer.alloc(0);
      return null;
    }

    let mask;
    if (masked) {
      if (buf.length < offset + 4) return null;
      mask = buf.slice(offset, offset + 4);
      offset += 4;
    }
    if (buf.length < offset + len) return null;

    let payload = buf.slice(offset, offset + len);
    if (masked) {
      const out = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
      payload = out;
    }
    this._buf = buf.slice(offset + len);
    return { fin, opcode, payload };
  }

  _handleFrame(frame) {
    const { fin, opcode, payload } = frame;
    switch (opcode) {
      case 0x0: // continuation
        this._fragChunks.push(payload);
        if (fin) {
          const full = Buffer.concat(this._fragChunks);
          const op = this._fragOpcode;
          this._fragChunks = [];
          this._fragOpcode = 0;
          if (op === 0x1 || op === 0x2) this.emit("message", full, op === 0x2);
        }
        break;
      case 0x1: // text
      case 0x2: // binary
        if (fin) {
          this.emit("message", payload, opcode === 0x2);
        } else {
          this._fragOpcode = opcode;
          this._fragChunks = [payload];
        }
        break;
      case 0x8: // close
        this._sendFrame(0x8, payload || Buffer.alloc(0));
        this._finish();
        break;
      case 0x9: // ping -> pong
        this._sendFrame(0xa, payload);
        break;
      case 0xa: // pong
        break;
      default:
        break;
    }
  }

  _sendFrame(opcode, payload) {
    if (this._closed || this._socket.destroyed) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.allocUnsafe(2);
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.allocUnsafe(4);
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.allocUnsafe(10);
      header[1] = 127;
      header.writeUInt32BE(Math.floor(len / 0x100000000), 2);
      header.writeUInt32BE(len >>> 0, 6);
    }
    header[0] = 0x80 | opcode; // FIN + opcode, server frames are unmasked
    try {
      this._socket.write(Buffer.concat([header, payload]));
    } catch (_) {}
  }

  send(data) {
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
    this._sendFrame(0x1, payload); // text
  }

  close(code, reason) {
    if (this._closed) return;
    let payload = Buffer.alloc(0);
    if (typeof code === "number") {
      const r = Buffer.from(reason ? String(reason) : "", "utf8");
      payload = Buffer.allocUnsafe(2 + r.length);
      payload.writeUInt16BE(code, 0);
      r.copy(payload, 2);
    }
    this._sendFrame(0x8, payload);
    this._finish();
  }

  _finish() {
    if (this._closed) return;
    this._closed = true;
    try {
      this._socket.end();
    } catch (_) {}
    this.emit("close");
  }
}

class WebSocketServer {
  constructor(opts) {
    this.options = opts || {};
  }

  handleUpgrade(req, socket, head, cb) {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }
    const headers = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      "Sec-WebSocket-Accept: " + accept(key),
      "\r\n",
    ];
    socket.write(headers.join("\r\n"));
    socket.setNoDelay(true);
    const ws = new FallbackSocket(socket);
    if (head && head.length) ws._onData(head);
    cb(ws);
  }
}

module.exports = { WebSocketServer };
