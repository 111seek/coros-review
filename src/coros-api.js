/** 运动类型 -> 中文名（基于 coros-mcp-server 的分类常量） */
export function sportTypeName(sportType) {
  const map = {
    100: "跑步",
    101: "跑步机",
    104: "徒步",
    200: "骑行",
    201: "骑行(室内)",
    402: "力量",
    501: "骑行台",
  };
  return map[Number(sportType)] ?? `类型${sportType}`;
}

/** 把 YYYYMMDD 或 YYYY-MM-DD 统一成 COROS 接口用的 YYYYMMDD 字符串 */
export function toCorosDate(day) {
  if (/^\d{8}$/.test(day)) return day;
  return String(day).replaceAll("-", "");
}

/** 秒 -> "1:23:45" / "23:45" */
export function formatDuration(totalSeconds) {
  const s = Math.round(Number(totalSeconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

/** 格式化 date 字段为 YYYY-MM-DD 展示 */
export function displayDate(corosDate) {
  const d = String(corosDate);
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d;
}

/**
 * 封装对 coros-mcp-server 的常用工具调用。
 */
export class CorosApi {
  constructor(client) {
    this.client = client;
  }

  /** 读取用户 profile（含 LTHR / 阈值配速等） */
  async getProfile() {
    return this.client.callTool("coros_get_profile", {});
  }

  /** 查询一段时间内的活动列表。date_from/date_to 形如 20260901。 */
  async listActivities({ dateFrom, dateTo, sportTypes, pageSize = 50, maxPages = 4 }) {
    const args = {};
    if (dateFrom) args.date_from = toCorosDate(dateFrom);
    if (dateTo) args.date_to = toCorosDate(dateTo);
    if (sportTypes?.length) args.sport_types = sportTypes;
    args.page_size = pageSize;
    args.max_pages = maxPages;
    return this.client.callTool("coros_list_activities", args);
  }

  /** 单次活动详情 + 自动诊断 */
  async analyzeActivity({ labelId, sportType, raw = false }) {
    return this.client.callTool("coros_analyze_activity", {
      label_id: labelId,
      sport_type: Number(sportType),
      raw,
    });
  }

  /** 近 7 天训练模式分析 */
  async analyzeRecentWeek({ endDay, raw = false } = {}) {
    const args = { raw };
    if (endDay) args.end_day = toCorosDate(endDay);
    return this.client.callTool("coros_analyze_recent_week", args);
  }

  /** 近期负荷 vs 基线负荷对比 */
  async analyzeTrainingBalance({ endDay, recentDays = 7, baselineDays = 21, raw = false } = {}) {
    const args = { recent_days: recentDays, baseline_days: baselineDays, raw };
    if (endDay) args.end_day = toCorosDate(endDay);
    return this.client.callTool("coros_analyze_training_balance", args);
  }
}
