import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import User from "@/models/User";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  businessId?: string;
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as SessionUser).id) return null;
  await dbConnect();
  const user = await User.findById((session.user as SessionUser).id).lean();
  return user;
}

export async function getSession() {
  return getServerSession(authOptions);
}

export function requireAuth(session: { user?: SessionUser }) {
  if (!session || !session.user || !session.user.id) {
    const err: Error & { status?: number } = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  return session.user;
}

export function requireRole(session: { user?: SessionUser }, role: string) {
  const user = requireAuth(session);
  if (user.role !== role) {
    const err: Error & { status?: number } = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  return user;
}