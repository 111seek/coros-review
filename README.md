# coros-review

高驰 COROS 训练数据复盘 CLI。把「每天看训练数据、复盘恢复状态」这件事固化成一条命令。

## 功能

| 命令 | 作用 |
|---|---|
| `coros-review daily` | 复盘某天训练（默认昨天），自动拉活动 + 汇总负荷/距离/时长 |
| `coros-review activity` | 单条活动深析：先按日期列出（带 label），再对指定活动输出诊断与建议 |
| `coros-review week` | 近 7 天训练模式 + 负荷平衡（近 7 天 vs 前 21 天基线） |

其中 **daily** 支持手动补充当天身体数据并落盘本地记录（不进仓库）：

```
coros-review daily --weight 80.2 --sleep 7.5 --hrv 55 --rhr 49
```

睡眠/体重/HRV/静息心率在 COROS 开放接口里没有，需手动补充——和日常记录习惯一致。
数据存在 `data/lifestyle.json`（已在 .gitignore 中，不会提交）。

## 架构

```
你的终端
  └─ coros-review CLI（本仓库：编排 + 格式化 + 复盘逻辑）
       └─ MCP stdio（JSON-RPC over stdio，仅 tools/call）
            └─ coros-mcp-server（上游数据服务，本地已配置并登录）
                 └─ COROS 私有 Web API
```

设计要点：

- **不含凭据**：CLI 不读取、不存储 COROS 会话；会话文件由上游 `coros-mcp-server`
  自行管理（默认 `~/.config/coros-mcp/session.json`）。
- **不含上游代码**：`coros-mcp-server` 是第三方开源项目（AustinCao/coros），
  本仓库只把它当数据通道，通过 MCP 协议调用，代码全部自研。
- **零运行时依赖**：纯 Node ESM，无 npm 依赖，`node src/cli.js` 直接可跑。

## 快速开始

前置：本机已配置并登录 `coros-mcp-server`。

```bash
git clone <repo-url> && cd coros-review

# 指定上游 server 启动方式（任选其一）
export COROS_REVIEW_SERVER_CMD='{"command":"/path/to/node","args":["/path/to/coros-mcp-server/dist/cli.js","serve"]}'
# 或写入用户配置 ~/.coros-review.json：
#   {"server":{"command":"/path/to/node","args":["/path/to/coros-mcp-server/dist/cli.js","serve"]}}
# 或直接复用 ~/.workbuddy/mcp.json 中名为 coros 的条目（WorkBuddy 场景自动识别）

node src/cli.js daily           # 复盘昨天
node src/cli.js daily --weight 80.2 --sleep 7.5
node src/cli.js activity --date 2026-09-01          # 列出某天活动
node src/cli.js activity --label 12345 --sport 200  # 深析单条
node src/cli.js week                                 # 近 7 天复盘
```

验证配置：`node src/cli.js --dry-run` 会打印将启动的上游 server 命令。

## 常用环境变量

| 变量 | 说明 |
|---|---|
| `COROS_REVIEW_SERVER_CMD` | 上游 server 启动 JSON：`{"command":...,"args":[...]}` |
| `COROS_REVIEW_LIFESTYLE_FILE` | 补充数据文件路径（默认 `./data/lifestyle.json`） |

## 开发

```bash
node scripts/smoke-offline.mjs   # 离线冒烟：桩数据验证输出渲染，不连真实 server
```

## 训练资料（`training/`）

除了 CLI，本仓库还收录个人公路车功率训练的三块材料，便于集中管理和版本化：

| 目录 | 内容 |
|---|---|
| `training/plan/` | **冬训周期化计划**（单文件 HTML，FTP 可调、含日历与运动量总结）+ 单节课程卡 |
| `training/course-library/` | **课型基座**：12 个课型 × 6 种能力，整理自《自行车功率训练完全指南》附录 A |
| `training/course-packs/` | **外部课程包**：C 包 8 周六修 16 节 FIT + 机器可读 `manifest.json` |
| `training/reports/` | 外部计划包 A/B 的拆解与适配性对比报告 |

细节见 [`training/README.md`](training/README.md)。

> HTML 产物均为单文件、零依赖，双击即可打开；改表头 FTP 会按 `%FTP` 重算全表瓦数。

## License

MIT
