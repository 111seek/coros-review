import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * 解析 coros-mcp-server 的启动方式。
 *
 * 优先级：
 *  1. 环境变量 COROS_REVIEW_SERVER_CMD（JSON：{"command":"...","args":[...]}）
 *  2. 配置文件 ~/.coros-review.json（同结构）
 *  3. WorkBuddy 的 MCP 配置 ~/.workbuddy/mcp.json 中名为 coros 的条目
 *  4. 环境变量 COROS_MCP_SERVER / COROS_MCP_SERVER_ARGS
 *
 * 注意：这里只读取「如何启动上游 server」，不读取也不存储任何会话凭据。
 * 会话文件由 coros-mcp-server 自行管理（默认 ~/.config/coros-mcp/session.json）。
 */
export function resolveServerLaunch() {
  // 1) 显式环境变量
  if (process.env.COROS_REVIEW_SERVER_CMD) {
    try {
      const parsed = JSON.parse(process.env.COROS_REVIEW_SERVER_CMD);
      if (parsed?.command) return { command: parsed.command, args: parsed.args ?? [] };
    } catch {
      throw new Error("COROS_REVIEW_SERVER_CMD 不是合法 JSON（需要 {\"command\":...,\"args\":[...]}）");
    }
  }

  // 2) 用户配置文件
  const userCfg = join(homedir(), ".coros-review.json");
  if (existsSync(userCfg)) {
    try {
      const parsed = JSON.parse(readFileSync(userCfg, "utf8"));
      if (parsed?.server?.command) {
        return { command: parsed.server.command, args: parsed.server.args ?? [] };
      }
    } catch {
      throw new Error(`配置文件 ${userCfg} 解析失败`);
    }
  }

  // 3) WorkBuddy MCP 配置中的 coros 条目
  const wbCfg = join(homedir(), ".workbuddy", "mcp.json");
  if (existsSync(wbCfg)) {
    try {
      const parsed = JSON.parse(readFileSync(wbCfg, "utf8"));
      const coros = parsed?.mcpServers?.coros;
      if (coros?.command) {
        return { command: coros.command, args: coros.args ?? [] };
      }
    } catch {
      /* 忽略，继续降级 */
    }
  }

  // 4) 简单环境变量
  if (process.env.COROS_MCP_SERVER) {
    return {
      command: process.env.COROS_MCP_SERVER,
      args: (process.env.COROS_MCP_SERVER_ARGS ?? "").split(/\s+/).filter(Boolean),
    };
  }

  throw new Error(
    [
      "找不到 coros-mcp-server 启动方式。",
      "请任选一种：",
      "  1) export COROS_REVIEW_SERVER_CMD='{\"command\":\"/path/to/node\",\"args\":[\"/path/to/coros-mcp-server/dist/cli.js\",\"serve\"]}'",
      "  2) 在 ~/.coros-review.json 写入 {\"server\":{\"command\":...,\"args\":[...]}}",
      "  3) 确保 ~/.workbuddy/mcp.json 中存在 mcpServers.coros 条目",
    ].join("\n"),
  );
}
