-- usage_events.raw_usage historical cleanup helper
-- Not a migration. Do not run automatically.
-- Run manually in small batches only after backup, sampling, and product/finance sign-off.

-- 1) Inspect the remaining large payloads.
select
  count(*) as oversized_rows,
  pg_size_pretty(coalesce(sum(pg_column_size(raw_usage)), 0)::bigint) as oversized_raw_usage_size
from public.usage_events
where raw_usage is not null
  and pg_column_size(raw_usage) > 32768;

-- 2) Review samples before changing data.
select
  id,
  run_id,
  model,
  billing_status,
  provider_request_id,
  upstream_task_id,
  created_at,
  pg_column_size(raw_usage) as raw_usage_bytes,
  left(raw_usage::text, 1200) as raw_usage_sample
from public.usage_events
where raw_usage is not null
  and pg_column_size(raw_usage) > 32768
order by created_at
limit 20;

-- 3) Repeat this transaction until the RETURNING set is empty.
begin;

with batch as materialized (
  select
    id,
    raw_usage,
    pg_column_size(raw_usage) as original_bytes
  from public.usage_events
  where raw_usage is not null
    and pg_column_size(raw_usage) > 32768
  order by created_at
  limit 250
  for update skip locked
),
summaries as (
  select
    id,
    original_bytes,
    jsonb_strip_nulls(jsonb_build_object(
      '_sanitized', true,
      '_sanitizedBy', 'docs/maintenance/usage-events-raw-usage-cleanup.sql',
      '_summaryVersion', 1,
      '_originalBytes', original_bytes,
      '_topLevelKeys',
        case
          when jsonb_typeof(raw_usage) = 'object' then coalesce((
            select jsonb_agg(key_name)
            from (
              select key_name
              from jsonb_object_keys(raw_usage) as keys(key_name)
              order by key_name
              limit 80
            ) top_keys
          ), '[]'::jsonb)
          else '[]'::jsonb
        end,
      'id', to_jsonb(nullif(coalesce(
        raw_usage ->> 'id',
        raw_usage #>> '{data,id}',
        raw_usage #>> '{raw,id}'
      ), '')),
      'request_id', to_jsonb(nullif(coalesce(
        raw_usage ->> 'request_id',
        raw_usage ->> 'requestId',
        raw_usage #>> '{data,request_id}',
        raw_usage #>> '{data,requestId}',
        raw_usage #>> '{raw,request_id}',
        raw_usage #>> '{raw,requestId}'
      ), '')),
      'task_id', to_jsonb(nullif(coalesce(
        raw_usage ->> 'task_id',
        raw_usage ->> 'taskId',
        raw_usage #>> '{data,task_id}',
        raw_usage #>> '{data,taskId}',
        raw_usage #>> '{raw,task_id}',
        raw_usage #>> '{raw,taskId}'
      ), '')),
      'status', to_jsonb(nullif(coalesce(
        raw_usage ->> 'status',
        raw_usage #>> '{data,status}',
        raw_usage #>> '{raw,status}',
        raw_usage ->> 'code',
        raw_usage ->> 'status_code'
      ), '')),
      'model', to_jsonb(nullif(coalesce(
        raw_usage ->> 'model',
        raw_usage ->> 'model_name',
        raw_usage #>> '{data,model}',
        raw_usage #>> '{data,model_name}',
        raw_usage #>> '{raw,model}',
        raw_usage #>> '{raw,model_name}'
      ), '')),
      'usage', jsonb_strip_nulls(jsonb_build_object(
        'input_tokens', coalesce(
          raw_usage #> '{usage,input_tokens}',
          raw_usage #> '{usage,prompt_tokens}',
          raw_usage #> '{data,usage,input_tokens}',
          raw_usage #> '{data,usage,prompt_tokens}',
          raw_usage #> '{raw,usage,input_tokens}',
          raw_usage #> '{raw,usage,prompt_tokens}',
          raw_usage #> '{raw,data,usage,input_tokens}',
          raw_usage #> '{raw,data,usage,prompt_tokens}'
        ),
        'output_tokens', coalesce(
          raw_usage #> '{usage,output_tokens}',
          raw_usage #> '{usage,completion_tokens}',
          raw_usage #> '{data,usage,output_tokens}',
          raw_usage #> '{data,usage,completion_tokens}',
          raw_usage #> '{raw,usage,output_tokens}',
          raw_usage #> '{raw,usage,completion_tokens}',
          raw_usage #> '{raw,data,usage,output_tokens}',
          raw_usage #> '{raw,data,usage,completion_tokens}'
        ),
        'cost_usd', coalesce(
          raw_usage #> '{usage,total_cost}',
          raw_usage #> '{usage,cost}',
          raw_usage #> '{data,cost}',
          raw_usage #> '{data,cost_usd}',
          raw_usage #> '{raw,cost}',
          raw_usage #> '{raw,cost_usd}',
          raw_usage #> '{raw,data,cost}',
          raw_usage #> '{raw,data,cost_usd}'
        )
      )),
      'error', jsonb_strip_nulls(jsonb_build_object(
        'message', to_jsonb(nullif(coalesce(
          raw_usage #>> '{error,message}',
          raw_usage #>> '{data,error,message}',
          raw_usage #>> '{raw,error,message}',
          raw_usage ->> 'message',
          raw_usage ->> 'msg',
          raw_usage ->> 'err'
        ), '')),
        'code', to_jsonb(nullif(coalesce(
          raw_usage #>> '{error,code}',
          raw_usage #>> '{data,error,code}',
          raw_usage #>> '{raw,error,code}',
          raw_usage ->> 'code',
          raw_usage ->> 'status_code'
        ), ''))
      ))
    )) as summary
  from batch
)
update public.usage_events as usage_events
set raw_usage = summaries.summary
from summaries
where usage_events.id = summaries.id
returning
  usage_events.id,
  summaries.original_bytes,
  pg_column_size(usage_events.raw_usage) as new_bytes;

commit;
