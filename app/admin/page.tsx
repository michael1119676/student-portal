import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PortalClient, {
  ManagedStudent,
  SessionUser,
} from "@/components/portal-client";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);

  if (!user || user.role !== "admin") {
    redirect("/");
  }

  const supabase = createAdminClient();
  const { data: students } = await supabase
    .from("students")
    .select("id, name, phone, role, class_name")
    .eq("role", "student")
    .order("name", { ascending: true });

  const managedStudents: ManagedStudent[] = (students || []).map((student) => ({
    id: student.id,
    name: student.name,
    phone: student.phone,
    role: "student",
    className: student.class_name,
  }));

  return (
    <PortalClient
      mode="admin"
      initialSessionUser={user as SessionUser}
      managedStudents={managedStudents}
    />
  );
}
