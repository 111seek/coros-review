// 离线冒烟：用桩数据验证 daily / activity / week 的输出渲染逻辑（不连真实 server）
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { runDaily, localYesterday } = await import(join(root, "src/commands/daily.js"));
const { runActivity } = await import(join(root, "src/commands/activity.js"));
const { runWeek } = await import(join(root, "src/commands/week.js"));

const stubApi = {
  async listActivities({ dateFrom }) {
    return {
      ok: true,
      data: {
        activities: [
          {
            label_id: "stub-001",
            sport_type: 200,
            name: "顺义线爬坡",
            date: dateFrom,
            distance_km: 72.7,
            total_time_s: 9900,
            workout_time_s: 9720,
            training_load: 180.5,
            avg_hr: 142,
            avg_power: 212,
            ascent_m: 440,
          },
          {
            label_id: "stub-002",
            sport_type: 402,
            name: "腿部力量",
            date: dateFrom,
            distance_km: 0,
            total_time_s: 2700,
            workout_time_s: 2400,
            training_load: 95,
            avg_hr: 110,
          },
        ],
      },
    };
  },
  async getProfile() {
    return { ok: true, data: { lthr: 166 } };
  },
  async analyzeActivity({ labelId }) {
    return {
      ok: true,
      data: {
        label_id: labelId,
        sport_type: 200,
        name: "顺义线爬坡",
        activity_type: "cycling",
        metrics: { distance_km: 72.7, total_time_s: 9900, training_load: 180.5, avg_hr: 142, max_hr: 176, avg_cadence: 88, avg_power: 212, ascent_m: 440 },
        conclusion: "这是一次有氧耐力骑行，节奏稳定。",
        evidence: ["训练负荷 180.5", "平均心率 142（Z2/Z3 边界）"],
        risks: [],
        suggestions: ["补水 500ml 后正餐摄入足量碳水"],
      },
    };
  },
  async analyzeRecentWeek() {
    return {
      ok: true,
      data: {
        date_from: "20260826",
        date_to: "20260901",
        conclusion: "这一周整体训练结构比较均衡。",
        evidence: ["共 5 条活动", "总训练负荷 612"],
        risks: ["力量与跑步叠加较多"],
        suggestions: ["关键课当天不要叠太重力量"],
      },
    };
  },
  async analyzeTrainingBalance() {
    return {
      ok: true,
      data: {
        recent_load: 612,
        baseline_load_per_week: 540,
        recent_distance_km: 188.2,
        baseline_distance_km_per_week: 175.0,
        recent_run_count: 4,
        baseline_run_count_per_week: 3.5,
        load_ratio: 1.13,
        suggestions: ["负荷处于合理区间"],
      },
    };
  },
};

const lifestyle = {
  get: () => ({ weight: 80.3, sleep: 7.2, hrv: 55, rhr: 49 }),
  recent: () => [{ date: "20260830", weight: 80.5 }, { date: "20260829", weight: 80.6 }, { date: "20260828", weight: 80.2 }],
  set: () => ({}),
};

const day = localYesterday();
console.log("===== daily =====");
console.log(await runDaily({ api: stubApi, lifestyle, day, recordFlags: {} }));
console.log("\n===== activity(list) =====");
console.log(await runActivity({ api: stubApi, day }));
console.log("\n===== activity(detail) =====");
console.log(await runActivity({ api: stubApi, day, labelId: "stub-001", sportType: 200 }));
console.log("\n===== week =====");
console.log(await runWeek({ api: stubApi, endDay: day }));
