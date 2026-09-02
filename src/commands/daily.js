import { formatDuration, round1, sportTypeName, displayDate } from "../coros-api.js";

/** 今日日期 YYYYMMDD（本地时区） */
export function localToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** 昨天日期 YYYYMMDD */
export function localYesterday() {
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** 解析 --date 2026-09-01 / 20260901 */
export function parseDayArg(value) {
  if (!value) return null;
  return String(value).replaceAll("-", "");
}

function hrZoneLabel(avgHr, lthr) {
  const hr = Number(avgHr) || 0;
  if (!hr || !lthr) return "";
  const pct = hr / lthr;
  if (pct >= 1.02) return "Z4+";
  if (pct >= 0.93) return "Z3";
  if (pct >= 0.85) return "Z2";
  return "Z1";
}

/**
 * daily：某一天的训练复盘（默认昨天）。
 * 训练数据自动拉取；睡眠/体重/HRV 手动补充（--sleep/--weight/--hrv/--rhr）。
 */
export async function runDaily({ api, lifestyle, day, recordFlags }) {
  const target = day ?? localYesterday();

  // 先写补充数据（如有）
  const supplementKeys = ["weight", "sleep", "hrv", "rhr"];
  const given = Object.entries(recordFlags).filter(([, v]) => v !== undefined && v !== null);
  if (given.length) {
    const fields = {};
    for (const [k, v] of given) {
      if (supplementKeys.includes(k)) fields[k] = Number(v);
    }
    lifestyle.set(target, fields);
  }

  const [activitiesResult, profileResult] = await Promise.all([
    api.listActivities({ dateFrom: target, dateTo: target }),
    api.getProfile().catch(() => null),
  ]);

  const lines = [];
  const title = `📋 高驰复盘 · ${displayDate(target)}`;
  lines.push(title, "=".repeat(title.length), "");

  // ---- 训练部分 ----
  if (!activitiesResult?.ok) {
    lines.push(`⚠️ 训练数据拉取失败：${activitiesResult?.error?.message ?? "未知错误"}`);
  } else {
    const acts = activitiesResult.data?.activities ?? [];
    if (acts.length === 0) {
      lines.push("🚴 当日无训练记录（休息日？）");
    } else {
      const lthr = Number(profileResult?.data?.lthr) || 0;
      lines.push(`当日训练 ${acts.length} 条：`);
      for (const a of acts) {
        const zone = hrZoneLabel(a.avg_hr, lthr);
        const parts = [
          `· ${sportTypeName(a.sport_type)}`,
          a.name ? `「${a.name}」` : "",
          a.distance_km ? `${round1(a.distance_km)}km` : "",
          formatDuration(a.workout_time_s || a.total_time_s),
          a.training_load ? `负荷 ${round1(a.training_load)}` : "",
          a.avg_hr ? `均心 ${a.avg_hr}` : "",
          a.avg_power ? `均功 ${a.avg_power}W` : "",
          zone ? `(${zone})` : "",
          a.ascent_m ? `爬升 ${a.ascent_m}m` : "",
        ].filter(Boolean);
        lines.push(parts.join(" "));
      }
      // 汇总
      const totalLoad = round1(acts.reduce((s, a) => s + (a.training_load || 0), 0));
      const totalKm = round1(acts.reduce((s, a) => s + (a.distance_km || 0), 0));
      const totalMin = Math.round(acts.reduce((s, a) => s + (a.workout_time_s || a.total_time_s || 0), 0) / 60);
      lines.push(`—— 合计：${acts.length} 条 / ${totalKm}km / ${totalMin} 分钟 / 负荷 ${totalLoad}`);
    }
  }

  // ---- 补充数据部分 ----
  const rec = lifestyle.get(target);
  if (rec) {
    lines.push("", "📌 身体数据（手动记录）：");
    const parts = [];
    if (rec.weight !== undefined) parts.push(`晨重 ${rec.weight}kg`);
    if (rec.sleep !== undefined) parts.push(`睡眠 ${rec.sleep}h`);
    if (rec.hrv !== undefined) parts.push(`HRV ${rec.hrv}`);
    if (rec.rhr !== undefined) parts.push(`静息心率 ${rec.rhr}`);
    if (parts.length) lines.push("· " + parts.join("｜"));

    // 与近 7 天做简单对比
    const prev = lifestyle
      .recent(8)
      .filter((r) => r.date < target && r.weight !== undefined)
      .slice(0, 3);
    if (prev.length && rec.weight !== undefined) {
      const avg = prev.reduce((s, r) => s + r.weight, 0) / prev.length;
      const diff = round1(rec.weight - avg);
      const trend = diff > 0.3 ? "↑（高于近 3 日均值，可能水分/碳水波动，勿慌）" : diff < -0.3 ? "↓（低于近 3 日均值）" : "→（与近 3 日均值持平）";
      lines.push(`· 体重趋势：${trend}（近 3 次 ${round1(avg)}kg，本次 ${diff >= 0 ? "+" : ""}${diff}）`);
    }
  } else {
    lines.push("", "📌 身体数据：今日未记录。可用 --weight 80.2 --sleep 7.5 --hrv 55 --rhr 49 补充。");
  }

  lines.push("");
  return lines.join("\n");
}
