import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Users, Shield, Plus, Key, History, Check, Eye, ArrowUpDown, Pencil, X } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore, store } from "../../lib/store";
import { ROLE_ORDER, type Role, type UserRow } from "../../lib/types";
import { fmtDateTime } from "../../lib/format";
import { toast } from "sonner";
import { SelectInput } from "../../components/ui/select-input";
import { TablePagination } from "../../components/TablePagination";

export const Route = createFileRoute("/web/users")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — User Management & Roles" },
      { name: "description", content: "Manage system access, permissions and view audit logs." },
    ],
  }),
  component: UserManagementPage,
});

function UserManagementPage() {
  const { t } = useI18n();
  const appState = useAppStore();

  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userBadge, setUserBadge] = useState("");
  const [userRole, setUserRole] = useState<Role>("operator");
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const [viewingUser, setViewingUser] = useState<UserRow | null>(null);

  const paginatedUsers = useMemo(() => {
    const s = (userPage - 1) * userPageSize;
    return appState.users.slice(s, s + userPageSize);
  }, [appState.users, userPage, userPageSize]);

  const handleRoleChange = (userId: string, newRole: Role) => {
    const user = appState.users.find((u) => u.id === userId);
    if (!user) return;
    store.updateUserRole(userId, newRole);
    toast.success(t("users.roleChanged", { name: user.name, role: newRole }));
  };

  const handleSaveUser = () => {
    if (!userName.trim() || !userEmail.trim()) {
      toast.error("Nama dan email wajib diisi");
      return;
    }
    store.addUser({
      name: userName.trim(),
      email: userEmail.trim(),
      badge: userBadge.trim() || `EMP-${Math.floor(100 + Math.random() * 900)}`,
      role: userRole,
    });
    toast.success("User baru berhasil ditambahkan");
    setUserName("");
    setUserEmail("");
    setUserBadge("");
    setAddUserModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            {t("users.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("users.subtitle")}
          </p>
        </div>

        <button
          onClick={() => setAddUserModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-2xs transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tambah Pengguna
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>{appState.users.length} Akun terdaftar</span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">{t("users.auditNote")}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="border-b border-border bg-slate-50/80 dark:bg-zinc-800/60 font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-20 whitespace-nowrap">ACTION</th>
                <th className="py-3.5 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {t("users.name")} <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </span>
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {t("users.email")} <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </span>
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {t("users.badge")} <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </span>
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {t("users.role")} <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </span>
                </th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Ubah Peran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
              {paginatedUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                  {/* Action on Left */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setViewingUser(u)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-blue-600 hover:border-blue-400 dark:hover:text-blue-400 shadow-2xs transition-colors"
                      title="Lihat Detail Pengguna"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>

                  {/* Name */}
                  <td className="py-3.5 px-4 font-medium text-foreground flex items-center gap-2.5 whitespace-nowrap">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center font-mono text-xs font-bold text-foreground border border-border">
                      {u.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span>{u.name}</span>
                  </td>

                  {/* Email */}
                  <td className="py-3.5 px-4 font-mono text-muted-foreground whitespace-nowrap">{u.email}</td>

                  {/* Badge */}
                  <td className="py-3.5 px-4 font-mono text-foreground font-bold whitespace-nowrap">{u.badge}</td>

                  {/* Role */}
                  <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase ${
                        u.role === "admin"
                          ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                          : u.role === "manager"
                          ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
                          : u.role === "supervisor"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          : u.role === "operator"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>

                  {/* Ubah Peran SelectInput */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-block w-40 text-left">
                      <SelectInput
                        hideClear
                        value={u.role}
                        onChange={(val) => {
                          if (val) handleRoleChange(u.id, val as Role);
                        }}
                        datalist={ROLE_ORDER.map((r) => ({
                          value: r,
                          label: t(`role.${r}` as any),
                        }))}
                        placeholder="Pilih Role"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* User Pagination */}
        <TablePagination
          page={userPage}
          pageSize={userPageSize}
          totalItems={appState.users.length}
          onPageChange={setUserPage}
          onPageSizeChange={setUserPageSize}
        />
      </div>

      {/* Audit Log Trail */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-sm font-semibold text-foreground">
            Riwayat Audit & Perubahan Sistem
          </h3>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 overflow-hidden divide-y divide-border text-xs font-mono">
          {appState.auditLogs.length === 0 ? (
            <div className="p-4 text-muted-foreground">Belum ada riwayat audit.</div>
          ) : (
            appState.auditLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="p-3 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-bold">{log.action}</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span className="text-muted-foreground">Oleh: {log.user}</span>
                  </div>
                  <p className="text-muted-foreground/80 font-sans text-[11px] leading-relaxed">
                    {log.details}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {fmtDateTime(log.timestampMs)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Add User */}
      {addUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-foreground mb-4">
              Tambah Pengguna Baru
            </h3>

            <div className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-muted-foreground mb-1">{t("users.name")}:</label>
                <input
                  type="text"
                  placeholder="Nama Lengkap"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full rounded border border-border bg-background p-2 text-foreground focus:outline-none focus:border-ring"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">{t("users.email")}:</label>
                <input
                  type="email"
                  placeholder="nama@krm.co.id"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full rounded border border-border bg-background p-2 text-foreground focus:outline-none focus:border-ring"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">{t("users.badge")}:</label>
                <input
                  type="text"
                  placeholder="Contoh: EMP-501"
                  value={userBadge}
                  onChange={(e) => setUserBadge(e.target.value)}
                  className="w-full rounded border border-border bg-background p-2 text-foreground focus:outline-none focus:border-ring"
                />
              </div>

              <div>
                <SelectInput
                  label={t("users.role")}
                  value={userRole}
                  onChange={(val) => {
                    if (val) setUserRole(val as Role);
                  }}
                  datalist={ROLE_ORDER.map((r) => ({
                    value: r,
                    label: t(`role.${r}` as any),
                  }))}
                  hideClear
                  placeholder="Pilih Role"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
              <button
                onClick={() => setAddUserModalOpen(false)}
                className="px-4 py-2 rounded border border-border font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveUser}
                className="px-4 py-2 rounded bg-primary text-primary-foreground font-semibold font-mono text-xs hover:bg-primary/90 shadow-2xs transition-colors"
              >
                Simpan Pengguna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View User Detail [ 👁 ] */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 font-sans text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Detail Data Pengguna</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">ID: {viewingUser.id}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingUser(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-[11px]">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold border border-primary/20">
                  {viewingUser.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <span className="text-foreground font-bold text-sm block">{viewingUser.name}</span>
                  <span className="text-muted-foreground text-xs">{viewingUser.email}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Nomor Badge</span>
                  <span className="text-foreground font-bold text-xs">{viewingUser.badge}</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Role Sistem</span>
                  <span className="text-foreground font-bold text-xs uppercase">{viewingUser.role}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

