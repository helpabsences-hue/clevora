import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export type TeamMember = {
  id: string;
  userId: string;
  role: "admin" | "staff";
  status: "active" | "disabled";
  fullName: string | null;
  email: string | null;
  phone: string | null;
};

export type PendingInvitation = {
  id: string;
  email: string | null;
  phone: string | null;
  role: "admin" | "staff";
  expiresAt: string;
  expired: boolean;
};

export async function getTeam(supabase: ServerSupabase, agencyId: string) {
  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from("agency_members")
      .select("id, user_id, role, status, created_at, profile:profiles!agency_members_user_id_fkey(full_name, email, phone)")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, email, phone, role, expires_at")
      .eq("agency_id", agencyId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const now = Date.now();
  return {
    members: (members ?? []).map<TeamMember>((m) => ({
      id: m.id,
      userId: m.user_id,
      role: m.role as TeamMember["role"],
      status: m.status as TeamMember["status"],
      fullName: m.profile?.full_name ?? null,
      email: m.profile?.email ?? null,
      phone: m.profile?.phone ?? null,
    })),
    invitations: (invitations ?? []).map<PendingInvitation>((i) => ({
      id: i.id,
      email: i.email,
      phone: i.phone,
      role: i.role as PendingInvitation["role"],
      expiresAt: i.expires_at,
      expired: new Date(i.expires_at).getTime() < now,
    })),
  };
}
