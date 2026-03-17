CREATE TABLE "company_provider_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"external_key_id" text,
	"secret_id" uuid NOT NULL,
	"secret_version" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"allow_save_logs" boolean DEFAULT false NOT NULL,
	"allow_manage_key" boolean DEFAULT false NOT NULL,
	"limit_cost_cents" integer,
	"limit_daily_cost_cents" integer,
	"expires_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_provider_key_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"provider_key_id" uuid NOT NULL,
	"assignment_mode" text DEFAULT 'exclusive' NOT NULL,
	"assigned_by_user_id" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_provider_keys" ADD CONSTRAINT "company_provider_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_provider_keys" ADD CONSTRAINT "company_provider_keys_secret_id_company_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_provider_key_assignments" ADD CONSTRAINT "user_provider_key_assignments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_provider_key_assignments" ADD CONSTRAINT "user_provider_key_assignments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_provider_key_assignments" ADD CONSTRAINT "user_provider_key_assignments_provider_key_id_company_provider_keys_id_fk" FOREIGN KEY ("provider_key_id") REFERENCES "public"."company_provider_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_provider_key_assignments" ADD CONSTRAINT "user_provider_key_assignments_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_provider_keys_company_provider_name_uq" ON "company_provider_keys" USING btree ("company_id","provider","name");--> statement-breakpoint
CREATE INDEX "company_provider_keys_company_status_idx" ON "company_provider_keys" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "company_provider_keys_company_provider_idx" ON "company_provider_keys" USING btree ("company_id","provider");--> statement-breakpoint
CREATE INDEX "company_provider_keys_secret_idx" ON "company_provider_keys" USING btree ("secret_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_provider_key_assignments_company_user_provider_key_uq" ON "user_provider_key_assignments" USING btree ("company_id","user_id","provider_key_id");--> statement-breakpoint
CREATE INDEX "user_provider_key_assignments_company_user_idx" ON "user_provider_key_assignments" USING btree ("company_id","user_id","revoked_at");--> statement-breakpoint
CREATE INDEX "user_provider_key_assignments_company_provider_key_idx" ON "user_provider_key_assignments" USING btree ("company_id","provider_key_id","revoked_at");