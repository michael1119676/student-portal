import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const csvPath = path.join(process.cwd(), "data", "student_profile.csv");
const raw = fs.readFileSync(csvPath, "utf-8");

const rows = parse(raw, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

function normalizePhone(phone) {
  return String(phone).replace(/\D/g, "");
}

for (const row of rows) {
  const name = (row["이름"] || "").trim();
  const phone = normalizePhone(row["전화번호"] || "");
  const className = (row["반"] || "").trim();

  if (!name || !phone) continue;

  const pinHash = await bcrypt.hash("1111", 10);
  const role = phone === "01011111111" ? "admin" : "student";

  const { error } = await supabase.from("students").upsert(
    {
      name,
      phone,
      role,
      pin_hash: pinHash,
      must_change_pin: true,
      korean_subject: null,
      math_subject: null,
      science_1: null,
      science_2: null,
      target_university: "seoul",
      class_name: className,
    },
    { onConflict: "phone" }
  );

  if (error) {
    console.error(name, phone, error.message);
  } else {
    console.log("seeded:", name, phone);
  }
}