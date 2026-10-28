import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, Shield, Plus, Key, History, Check } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore, store } from "../../lib/store";
import { ROLE_ORDER, type Role, type UserRow } from "../../lib/types";
import { fmtDateTime } from "../../lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/web/users")({
  head: () => ({
    meta: [
      { title: "JSGI — User Management & Roles" },
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
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">
            {t("users.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("users.subtitle")}
          </p>
        </div>

        <button
          onClick={() => setAddUserModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 font-mono text-xs font-semibold text-black hover:bg-white/90 shadow transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tambah Pengguna
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-white/10 bg-[#0d0d10] overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>{appState.users.length} Akun terdaftar</span>
          <span className="text-amber-400/90">{t("users.auditNote")}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="border-b border-white/10 bg-black/60 font-mono text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="py-3 px-4">{t("users.name")}</th>
                <th className="py-3 px-4">{t("users.email")}</th>
                <th className="py-3 px-4">{t("users.badge")}</th>
                <th className="py-3 px-4">{t("users.role")}</th>
                <th className="py-3 px-4 text-right">Ubah Peran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {appState.users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-medium text-white flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center font-mono text-xs font-bold text-white border border-white/10">
                      {u.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span>{u.name}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">{u.email}</td>
                  <td className="py-3 px-4 font-mono text-white font-bold">{u.badge}</td>
                  <td className="py-3 px-4 font-mono">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                        u.role === "admin"
                          ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                          : u.role === "manager"
                          ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                          : u.role === "supervisor"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : u.role === "operator"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-white/5 text-muted-foreground border-white/10"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      className="rounded border border-white/10 bg-black px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-white/40"
                    >
                      {ROLE_ORDER.map((r) => (
                        <option key={r} value={r}>
                          {t(`role.${r}` as any)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Trail */}
      <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-sm font-semibold text-white">
            Riwayat Audit & Perubahan Sistem
          </h3>
        </div>

        <div className="rounded-lg border border-white/10 bg-black overflow-hidden divide-y divide-white/5 text-xs font-mono">
          {appState.auditLogs.length === 0 ? (
            <div className="p-4 text-muted-foreground">Belum ada riwayat audit.</div>
          ) : (
            appState.auditLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="p-3 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{log.action}</span>
                    <span className="text-white/20">•</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/20 bg-[#121215] p-6 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-white mb-4">
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
                  className="w-full rounded border border-white/10 bg-black p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">{t("users.email")}:</label>
                <input
                  type="email"
                  placeholder="nama@jsgi.co.id"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full rounded border border-white/10 bg-black p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">{t("users.badge")}:</label>
                <input
                  type="text"
                  placeholder="Contoh: EMP-501"
                  value={userBadge}
                  onChange={(e) => setUserBadge(e.target.value)}
                  className="w-full rounded border border-white/10 bg-black p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">{t("users.role")}:</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as Role)}
                  className="w-full rounded border border-white/10 bg-black p-2 text-white"
                >
                  {ROLE_ORDER.map((r) => (
                    <option key={r} value={r}>
                      {t(`role.${r}` as any)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/10">
              <button
                onClick={() => setAddUserModalOpen(false)}
                className="px-4 py-2 rounded border border-white/10 font-mono text-xs text-muted-foreground hover:bg-white/5"
              >
                Batal
              </button>
              <button
                onClick={handleSaveUser}
                className="px-4 py-2 rounded bg-white text-black font-semibold font-mono text-xs hover:bg-white/90"
              >
                Simpan Pengguna
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
