import { round1, sportTypeName, formatDuration } from "../coros-api.js";
import { parseDayArg, localToday } from "./daily.js";

/**
 * week：近 7 天训练负荷与恢复分析。
 * 组合 coros_analyze_recent_week（7 天训练模式）与 coros_analyze_training_balance（负荷平衡）。
 */
export async function runWeek({ api, endDay, recentDays, baselineDays, raw }) {
  const end = parseDayArg(endDay) ?? localToday();
  const [weekResult, balanceResult] = await Promise.all([
    api.analyzeRecentWeek({ endDay: end, raw }),
    api.analyzeTrainingBalance({
      endDay: end,
      recentDays: recentDays ?? 7,
      baselineDays: baselineDays ?? 21,
      raw,
    }),
  ]);

  const lines = [];
  lines.push(`📊 近 7 天训练复盘（截至 ${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}）`, "");

  // 近 7 天逐日活动
  const dayStart = new Date(`${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}`);
  dayStart.setDate(dayStart.getDate() - 6);
  const pad = (n) => String(n).padStart(2, "0");
  const startStr = `${dayStart.getFullYear()}${pad(dayStart.getMonth() + 1)}${pad(dayStart.getDate())}`;

  const listResult = await api.listActivities({ dateFrom: startStr, dateTo: end, maxPages: 8 });
  if (listResult?.ok) {
    const acts = listResult.data?.activities ?? [];
    lines.push("每日活动：");
    const byDay = new Map();
    for (const a of acts) {
      const day = String(a.date);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(a);
    }
    for (const [day, items] of [...byDay.entries()].sort()) {
      const dd = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
      const summary = items
        .map((a) => {
          const parts = [
            sportTypeName(a.sport_type),
            a.distance_km ? `${round1(a.distance_km)}km` : "",
            formatDuration(a.workout_time_s || a.total_time_s),
            a.training_load ? `负荷${round1(a.training_load)}` : "",
          ].filter(Boolean);
          return parts.join(" ");
        })
        .join("；");
      lines.push(`· ${dd}：${summary || "休息"}`);
    }
  }

  // 7 天模式结论
  if (weekResult?.ok) {
    const d = weekResult.data;
    lines.push("", "💬 7 天模式诊断：");
    lines.push(d.conclusion ?? "");
    for (const e of d.evidence ?? []) lines.push(`· ${e}`);
    for (const r of d.risks ?? []) lines.push(`⚠️ ${r}`);
    lines.push("", "✅ 建议：");
    for (const s of d.suggestions ?? []) lines.push(`· ${s}`);
  } else {
    lines.push(`\n7 天模式分析失败：${weekResult?.error?.message ?? "未知错误"}`);
  }

  // 负荷平衡
  if (balanceResult?.ok) {
    const b = balanceResult.data;
    lines.push("", "⚖️ 负荷平衡（近 7 天 vs 前 21 天基线）：");
    const row = (label, recent, baseline, unit) =>
      `· ${label}：${recent}${unit} vs 基线 ${baseline}${unit}`;
    if (b.recent_load !== undefined) lines.push(row("跑步负荷", round1(b.recent_load), round1(b.baseline_load_per_week), ""));
    if (b.recent_distance_km !== undefined)
      lines.push(row("跑步距离", round1(b.recent_distance_km), round1(b.baseline_distance_km_per_week), "km"));
    if (b.recent_run_count !== undefined) lines.push(row("跑步次数", b.recent_run_count, round1(b.baseline_run_count_per_week), "次"));
    if (b.load_ratio !== undefined) {
      const ratio = round1(b.load_ratio);
      const flag = ratio > 1.3 ? "⚠️ 超基线，注意恢复" : ratio < 0.7 ? "⬇️ 低于基线（恢复周？）" : "✅ 处于合理区间";
      lines.push(`· 负荷比值：${ratio} ${flag}`);
    }
    for (const s of b.suggestions ?? []) lines.push(`· ${s}`);
  } else {
    lines.push(`\n负荷平衡分析失败：${balanceResult?.error?.message ?? "未知错误"}`);
  }

  lines.push("");
  return lines.join("\n");
}
