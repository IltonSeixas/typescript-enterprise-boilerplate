CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" uuid,
	"target_id" uuid,
	"detail" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log" USING btree ("actor_id");