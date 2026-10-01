import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { authOptions } from "./options";

export type CurrentUser = {
  id: number;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  // The session carries the database id as a string (JWT claim); sessions
  // minted before ids were numeric, or tampered ones, are treated as signed out.
  const id = Number(user?.id);
  if (!user || !Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  return {
    id,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}

export async function requirePageUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user, response: null };
}
