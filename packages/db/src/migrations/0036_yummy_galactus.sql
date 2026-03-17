CREATE TABLE "provider_request_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text,
	"provider_key_id" uuid,
	"agent_id" uuid,
	"cost_event_id" uuid,
	"external_request_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"request_method" text,
	"request_path" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"http_status" integer,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer,
	"request_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_completed_at" timestamp with time zone,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN "provider_key_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN "external_request_id" text;--> statement-breakpoint
ALTER TABLE "provider_request_logs" ADD CONSTRAINT "provider_request_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_request_logs" ADD CONSTRAINT "provider_request_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_request_logs" ADD CONSTRAINT "provider_request_logs_provider_key_id_company_provider_keys_id_fk" FOREIGN KEY ("provider_key_id") REFERENCES "public"."company_provider_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_request_logs" ADD CONSTRAINT "provider_request_logs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_request_logs" ADD CONSTRAINT "provider_request_logs_cost_event_id_cost_events_id_fk" FOREIGN KEY ("cost_event_id") REFERENCES "public"."cost_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_request_logs_company_external_request_uq" ON "provider_request_logs" USING btree ("company_id","external_request_id");--> statement-breakpoint
CREATE INDEX "provider_request_logs_company_user_started_idx" ON "provider_request_logs" USING btree ("company_id","user_id","request_started_at");--> statement-breakpoint
CREATE INDEX "provider_request_logs_company_provider_key_started_idx" ON "provider_request_logs" USING btree ("company_id","provider_key_id","request_started_at");--> statement-breakpoint
CREATE INDEX "provider_request_logs_company_started_idx" ON "provider_request_logs" USING btree ("company_id","request_started_at");--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_provider_key_id_company_provider_keys_id_fk" FOREIGN KEY ("provider_key_id") REFERENCES "public"."company_provider_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_events_company_user_occurred_idx" ON "cost_events" USING btree ("company_id","user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "cost_events_company_provider_key_occurred_idx" ON "cost_events" USING btree ("company_id","provider_key_id","occurred_at");--> statement-breakpoint
CREATE INDEX "cost_events_company_external_request_idx" ON "cost_events" USING btree ("company_id","external_request_id");