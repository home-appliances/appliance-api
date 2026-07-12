CREATE TABLE "admins" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admins_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"role" text DEFAULT 'admin',
	"status" text DEFAULT 'active',
	"avatar" text,
	"remark" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_login" timestamp,
	CONSTRAINT "admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"icon" text,
	"parent_id" bigint,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "category_params" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "category_params_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"category_id" bigint NOT NULL,
	"param_key" text NOT NULL,
	"display_name" text NOT NULL,
	"icon" text,
	"param_type" text DEFAULT 'text' NOT NULL,
	"is_core" boolean DEFAULT false,
	"is_filter" boolean DEFAULT false,
	"is_sortable" boolean DEFAULT false,
	"enum_values" jsonb,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "category_params_category_param_unique" UNIQUE("category_id","param_key")
);
--> statement-breakpoint
CREATE TABLE "crawler_tasks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "crawler_tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"category" text,
	"status" text DEFAULT 'pending',
	"progress" integer DEFAULT 0,
	"total_products" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"fail_count" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "operation_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "operation_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"admin_id" bigint,
	"operator" text NOT NULL,
	"ip" text,
	"type" text NOT NULL,
	"target" text,
	"result" text DEFAULT 'success',
	"detail" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_images_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"product_id" bigint NOT NULL,
	"image_url" text,
	"image_type" text DEFAULT 'main' NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_product_type_sort_unique" UNIQUE("product_id","image_type","sort_order")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"model" text,
	"category_id" bigint,
	"price" numeric(10, 2),
	"original_price" numeric(10, 2),
	"rating" numeric(3, 1),
	"review_count" integer DEFAULT 0,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_vector" text,
	"pinyin" text,
	"pinyin_initials" text,
	"source_url" text,
	"source_platform" text DEFAULT 'pconline',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text,
	CONSTRAINT "products_source_url_unique" UNIQUE("source_url")
);
--> statement-breakpoint
CREATE TABLE "search_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "search_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"keyword" text NOT NULL,
	"search_count" integer DEFAULT 1 NOT NULL,
	"last_searched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_logs_keyword_unique" UNIQUE("keyword")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
