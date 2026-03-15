import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ShopClient from "@/components/shop-client";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export default async function ShopPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);

  if (!user) {
    redirect("/");
  }

  return <ShopClient initialUser={user} />;
}

