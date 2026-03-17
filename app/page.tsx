import { redirect } from "next/navigation";
import PortalClient from "@/components/portal-client";
import { getSessionContextFromCookies } from "@/lib/api-auth";

export default async function Page() {
  const { user, profile } = await getSessionContextFromCookies();

  if (user?.role === "admin") {
    redirect("/admin");
  }

  return (
    <PortalClient
      mode="student"
      initialSessionUser={user}
      initialProfile={profile}
    />
  );
}
