import { redirect } from "next/navigation";
import ShopClient from "@/components/shop-client";
import { getSessionUserFromCookies } from "@/lib/api-auth";

export default async function ShopPage() {
  const user = await getSessionUserFromCookies();

  if (!user) {
    redirect("/");
  }

  return <ShopClient initialUser={user} />;
}
