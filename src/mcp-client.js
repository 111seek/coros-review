import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

/**
 * 极简 MCP stdio 客户端（JSON-RPC 2.0 over stdio）。
 * 仅实现本 CLI 需要的 initialize / notifications/initialized / tools/call。
 */
export class McpStdioClient {
  constructor({ command, args = [], env = {} }) {
    this.command = command;
    this.args = args;
    this.env = env;
    this.child = null;
    this.rl = null;
    this.nextId = 1;
    this.pending = new Map();
    this.stderrTail = "";
  }

  async connect() {
    this.child = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.env },
    });

    this.rl = createInterface({ input: this.child.stdout });
    this.rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        return; // 非 JSON 行，忽略
      }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message ?? "MCP request failed"));
        } else {
          resolve(msg.result);
        }
      }
    });

    this.child.stderr.on("data", (chunk) => {
      const tail = String(chunk);
      this.stderrTail = (this.stderrTail + tail).slice(-2000);
    });

    this.child.on("exit", (code) => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`MCP server exited with code ${code}`));
      }
      this.pending.clear();
    });

    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "coros-review", version: "0.1.0" },
    });

    this.notify("notifications/initialized", {});
    return this;
  }

  _send(msg) {
    this.child.stdin.write(JSON.stringify(msg) + "\n");
  }

  request(method, params, timeoutMs = 120_000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this._send({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method, params) {
    this._send({ jsonrpc: "2.0", method, params });
  }

  /** 调用一个 MCP 工具。返回解析后的 JSON 值。 */
  async callTool(name, arguments_) {
    const result = await this.request("tools/call", { name, arguments: arguments_ ?? {} });
    const text = result?.content?.find((item) => item.type === "text")?.text;
    if (text === undefined) {
      throw new Error(`tool ${name}: no text content in response`);
    }
    return JSON.parse(text);
  }

  close() {
    try {
      this.child?.kill("SIGTERM");
    } catch {
      /* noop */
    }
  }
}
