#!/usr/bin/env node
import { McpStdioClient } from "./mcp-client.js";
import { resolveServerLaunch } from "./server-config.js";
import { CorosApi } from "./coros-api.js";
import { LifestyleStore } from "./lifestyle-store.js";
import { runDaily, localYesterday } from "./commands/daily.js";
import { runActivity } from "./commands/activity.js";
import { runWeek } from "./commands/week.js";

const HELP = `
coros-review — 高驰 COROS 训练数据复盘 CLI

用法：
  coros-review daily    [--date 2026-09-01] [--weight 80.2] [--sleep 7.5] [--hrv 55] [--rhr 49]
     复盘某一天训练（默认昨天）。训练自动拉取；睡眠/体重/HRV 手动补充并本地记录。

  coros-review activity --date 2026-09-01
     列出某天活动及 label_id（默认昨天）。
  coros-review activity --label <id> --sport <n>
     深度分析单条活动（conclusion / risks / suggestions）。

  coros-review week [--end 2026-09-02] [--recent-days 7] [--baseline-days 21]
     近 7 天训练模式 + 负荷平衡（vs 前 21 天基线）。

上游依赖：本机需已配置并登录 coros-mcp-server
（参考 ~/.workbuddy/mcp.json 的 coros 条目，会话文件不读取、不存储）。

环境变量：
  COROS_REVIEW_SERVER_CMD  上游 server 启动 JSON（{"command":"...","args":[...]}）
  COROS_REVIEW_LIFESTYLE_FILE  补充数据文件路径（默认 ./data/lifestyle.json）
`;

function parseFlags(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { flags, positionals };
}

async function main() {
  const { flags, positionals } = parseFlags(process.argv.slice(2));
  const command = positionals[0];

  if (flags["dry-run"]) {
    const launch = resolveServerLaunch();
    console.log(`[dry-run] 上游 server：${launch.command} ${launch.args.join(" ")}`);
    return;
  }

  if (!command || command === "help" || command === "--help" || flags.help) {
    console.log(HELP);
    return;
  }

  const launch = resolveServerLaunch();
  const client = await new McpStdioClient(launch).connect();
  const api = new CorosApi(client);
  const lifestyle = new LifestyleStore();

  try {
    switch (command) {
      case "daily": {
        const out = await runDaily({
          api,
          lifestyle,
          day: flags.date ? String(flags.date).replaceAll("-", "") : localYesterday(),
          recordFlags: {
            weight: flags.weight,
            sleep: flags.sleep,
            hrv: flags.hrv,
            rhr: flags.rhr,
          },
        });
        console.log(out);
        break;
      }
      case "activity": {
        const out = await runActivity({
          api,
          day: flags.date,
          labelId: flags.label,
          sportType: flags.sport !== undefined ? Number(flags.sport) : undefined,
          raw: Boolean(flags.raw),
        });
        console.log(out);
        break;
      }
      case "week": {
        const out = await runWeek({
          api,
          endDay: flags.end,
          recentDays: flags["recent-days"] !== undefined ? Number(flags["recent-days"]) : undefined,
          baselineDays: flags["baseline-days"] !== undefined ? Number(flags["baseline-days"]) : undefined,
          raw: Boolean(flags.raw),
        });
        console.log(out);
        break;
      }
      default:
        console.error(`未知命令：${command}`);
        console.log(HELP);
        process.exitCode = 1;
    }
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
