import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FILE = join(ROOT, "data", "lifestyle.json");

/**
 * 补充数据存储：体重 / 睡眠时长 / HRV / 静息心率。
 * 这些指标 COROS MCP 没有接口，需要手动记录（与每日复盘习惯一致）。
 * 数据保存在本地 data/lifestyle.json（已 gitignore，不进仓库）。
 */
export class LifestyleStore {
  constructor(file = process.env.COROS_REVIEW_LIFESTYLE_FILE || DEFAULT_FILE) {
    this.file = file;
    this.records = {};
    if (existsSync(file)) {
      try {
        this.records = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        this.records = {};
      }
    }
  }

  /** 读取某天的记录，无则返回 null */
  get(date) {
    return this.records[date] ?? null;
  }

  /** 写入某天的记录，返回合并后的记录 */
  set(date, fields) {
    this.records[date] = { ...(this.records[date] ?? {}), ...fields };
    this._flush();
    return this.records[date];
  }

  /** 最近 n 条有记录的天（按日期倒序） */
  recent(n = 7) {
    return Object.entries(this.records)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, n)
      .map(([date, record]) => ({ date, ...record }));
  }

  _flush() {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.records, null, 2), "utf8");
  }
}
