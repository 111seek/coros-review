import { formatDuration, round1, sportTypeName, displayDate } from "../coros-api.js";
import { parseDayArg, localYesterday } from "./daily.js";

/**
 * activity：分析单条活动。
 * 用法：
 *   coros-review activity --date 20260901          # 列出某天活动（默认昨天），显示 label_id
 *   coros-review activity --label <id> --sport <n> # 对指定活动深度分析
 */
export async function runActivity({ api, day, labelId, sportType, raw }) {
  const lines = [];

  if (labelId) {
    if (sportType === undefined) {
      throw new Error("指定 --label 时必须同时提供 --sport（活动类型编号）");
    }
    const result = await api.analyzeActivity({ labelId, sportType: Number(sportType), raw });
    if (!result?.ok) {
      return `❌ 活动分析失败：${result?.error?.message ?? "未知错误"}`;
    }
    const d = result.data;
    lines.push(`🎯 活动分析 · ${d.name ?? displayDate(day ?? "")}`, "");
    lines.push(`类型：${sportTypeName(d.sport_type)}（${d.activity_type ?? "other"}）`);
    lines.push(`距离：${round1(d.metrics?.distance_km)}km`);
    lines.push(`时长：${formatDuration(d.metrics?.total_time_s)}`);
    lines.push(`训练负荷：${round1(d.metrics?.training_load)}`);
    if (d.metrics?.avg_hr) lines.push(`平均心率：${d.metrics.avg_hr} bpm`);
    if (d.metrics?.max_hr) lines.push(`最大心率：${d.metrics.max_hr} bpm`);
    if (d.metrics?.avg_cadence) lines.push(`平均踏频/步频：${d.metrics.avg_cadence}`);
    if (d.metrics?.avg_power) lines.push(`平均功率：${d.metrics.avg_power} W`);
    if (d.metrics?.ascent_m) lines.push(`爬升：${d.metrics.ascent_m} m`);
    lines.push("");
    lines.push(`💬 ${d.conclusion}`);
    for (const e of d.evidence ?? []) lines.push(`· ${e}`);
    for (const r of d.risks ?? []) lines.push(`⚠️ ${r}`);
    lines.push("");
    lines.push("✅ 建议：");
    for (const s of d.suggestions ?? []) lines.push(`· ${s}`);
    return lines.join("\n");
  }

  // 未指定 label：列出某天活动
  const target = day ?? localYesterday();
  const result = await api.listActivities({ dateFrom: target, dateTo: target });
  if (!result?.ok) {
    return `❌ 活动列表拉取失败：${result?.error?.message ?? "未知错误"}`;
  }
  const acts = result.data?.activities ?? [];
  if (acts.length === 0) {
    return `当日 ${displayDate(target)} 无训练记录。`;
  }
  lines.push(`📅 ${displayDate(target)} 的活动：`, "");
  for (const a of acts) {
    lines.push(
      [
        `· label=${a.label_id}  sport=${a.sport_type}（${sportTypeName(a.sport_type)}）`,
        a.name ? `「${a.name}」` : "",
        a.distance_km ? `${round1(a.distance_km)}km` : "",
        formatDuration(a.workout_time_s || a.total_time_s),
        a.training_load ? `负荷 ${round1(a.training_load)}` : "",
      ].filter(Boolean).join(" "),
    );
  }
  lines.push("", "深度分析：coros-review activity --label <id> --sport <n>");
  return lines.join("\n");
}
