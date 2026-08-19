"use server";

import { cookies } from "next/headers";
import { signOut } from "@/auth";

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("active_company");
  await signOut({ redirectTo: "/login" });
}
