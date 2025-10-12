CREATE TABLE "public"."user_socialites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "socialite_id" TEXT NOT NULL,
    "socialite_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_socialites_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_socialites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_socialites_socialite_name_socialite_id_key" ON "public"."user_socialites"("socialite_name", "socialite_id");