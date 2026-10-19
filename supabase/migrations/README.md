# 后续迁移顺序

原有编号 SQL 继续保留在父目录；本目录记录后续版本化修正，不能单独作为空数据库的完整初始化。

本次生产应用顺序：

1. `20261019123659 admin_rbac_lifecycle_dashboard_release_20261019`：对应 `../016_admin_rbac_lifecycle.sql`。保留其原文件及依赖顺序；实际工具事务 payload 与 SHA 记录在 `output/dashboard-release-2026-10-19/`。
2. `20261019124029 harden_admin_workspace_transfer_plan_grants`：对应本目录同版本 SQL；清除 Supabase 默认赋予服务角色的 transfer plans 写入/维护权限，仅保留 SELECT。真正写入继续由 postgres 所有的 SECURITY DEFINER RPC 执行。

第二条文件由 Supabase CLI `migration new` 生成后，对齐 apply_migration 实际登记的版本号。原 016 未被改写。完整数据库初始化须先应用父目录的基础迁移及 016，再应用本修正。
