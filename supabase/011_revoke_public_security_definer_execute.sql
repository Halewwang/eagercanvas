-- Supabase linter remediation:
-- prevent API roles from directly executing SECURITY DEFINER helper functions.

do $$
begin
  if to_regprocedure('public.has_permission(uuid, text)') is not null then
    revoke execute on function public.has_permission(uuid, text) from public, anon, authenticated;
    grant execute on function public.has_permission(uuid, text) to service_role;
  end if;

  if to_regprocedure('public.has_role(uuid, text)') is not null then
    revoke execute on function public.has_role(uuid, text) from public, anon, authenticated;
    grant execute on function public.has_role(uuid, text) to service_role;
  end if;

  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
    grant execute on function public.rls_auto_enable() to service_role;
  end if;
end $$;
