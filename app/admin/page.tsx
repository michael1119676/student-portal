import { redirect } from "next/navigation";
import PortalClient, {
  ManagedStudent,
  SessionUser,
} from "@/components/portal-client";
import { getSessionUserFromCookies } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminPage() {
  const user = await getSessionUserFromCookies();

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
