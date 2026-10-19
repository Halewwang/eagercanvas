-- Supabase default grants include write/maintenance privileges; writes belong to the postgres-owned definer RPC.
REVOKE ALL PRIVILEGES ON TABLE public.admin_workspace_transfer_plans FROM service_role;
GRANT SELECT ON TABLE public.admin_workspace_transfer_plans TO service_role;
