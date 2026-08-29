import type { Metadata } from "next";

import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { AccountSecurity } from "@/components/admin/account-security";
import { InviteMember } from "@/components/admin/invite-member";
import { StatRow } from "@/components/admin/stat-row";
import { PageHeader } from "@/components/admin/table";
import { Badge } from "@/components/ui";
import { getCurrentAdmin } from "@/lib/auth/server";
import { formatDate, formatNumber, timeAgo } from "@/lib/utils";
import { listAdmins } from "@/server/repositories/admin-users";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team & roles" };

export default async function TeamPage() {
  const [members, me] = await Promise.all([listAdmins(), getCurrentAdmin()]);

  const admins = members.filter((m) => m.role === "admin").length;
  const active = members.filter((m) => m.active).length;
  const signedIn = members.filter((m) => m.lastLoginAt).length;

  return (
    <>
      <PageHeader
        title="Team & roles"
        subtitle="No account is hardcoded. The first administrator is created once at /setup, which then closes permanently — every account after it is created here, by someone already signed in."
      />

      <StatRow
        stats={[
          { label: "Accounts", value: formatNumber(members.length) },
          { label: "Administrators", value: formatNumber(admins) },
          { label: "Active", value: formatNumber(active), tone: "success" },
          { label: "Have signed in", value: formatNumber(signedIn) },
        ]}
      />

      <AccountSecurity />

      <div className="mb-5">
        <InviteMember />
      </div>

      <DataTable
        rowCount={members.length}
        minWidth={820}
        columns={[
          { label: "Name" },
          { label: "Email" },
          { label: "Role" },
          { label: "Created" },
          { label: "Last signed in" },
          { label: "Status", align: "right" },
        ]}
        empty={{ title: "No accounts", detail: "Visit /setup to create the first administrator." }}
      >
        {members.map((m) => (
          <Tr key={m.id}>
            <Td strong>
              {m.name}
              {me?.id === m.id && <span className="ml-2 text-[11px] font-normal text-ink-400">(you)</span>}
            </Td>
            <Td muted>{m.email}</Td>
            <Td>
              <Badge tone={m.role === "admin" ? "softWarning" : "neutral"}>{m.role}</Badge>
            </Td>
            <Td muted>{formatDate(m.createdAt, { day: "numeric", month: "short", year: "numeric" })}</Td>
            <Td muted>{m.lastLoginAt ? timeAgo(m.lastLoginAt) : "never"}</Td>
            <Td align="right">
              <Badge tone={m.active ? "softSuccess" : "softDanger"}>{m.active ? "active" : "disabled"}</Badge>
            </Td>
          </Tr>
        ))}
      </DataTable>

      <p className="mt-4 text-[13px] text-ink-400">
        Roles are enforced on the server, not in the interface: a viewer holding a valid session still receives a 403
        from every mutating endpoint. Sessions are stateless signed cookies, which keeps the edge check free of a
        database round trip, but each one carries the account&rsquo;s session version — so deactivating an account,
        changing a password or signing out everywhere invalidates tokens already issued instead of waiting out the
        eight-hour expiry.
      </p>
    </>
  );
}
