"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/ui/Card";
import { Button } from "@/shared/ui/ui/Button";
import { Badge } from "@/shared/ui/ui/Badge";
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from "@/shared/hooks/useRoles";
import { ALL_PERMISSIONS, ROLE_PERMISSIONS, ROLE_LABELS, Permission } from "@/shared/lib/permissions";
import { Role } from "@prisma/client";
import {
  Shield, Plus, Pencil, Trash2, X, Check, Users, ChevronDown, ChevronUp,
} from "lucide-react";

const SYSTEM_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "SALES_EXECUTIVE", "STORE_MANAGER", "EMPLOYEE"];

const ROLE_COLORS: Record<string, "violet" | "info" | "success" | "warning"> = {
  SUPER_ADMIN:     "violet",
  ADMIN:           "info",
  ACCOUNTANT:      "success",
  SALES_EXECUTIVE: "warning",
  STORE_MANAGER:   "info",
  EMPLOYEE:        "warning",
};

// Group permissions by their group field
const permissionGroups = ALL_PERMISSIONS.reduce<Record<string, typeof ALL_PERMISSIONS>>((acc, p) => {
  (acc[p.group] ??= []).push(p);
  return acc;
}, {});

export default function RolesPage() {
  const { data: customRoles, isLoading } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPerms, setFormPerms] = useState<string[]>(["view_dashboard"]);

  const resetForm = () => {
    setFormName("");
    setFormDesc("");
    setFormPerms(["view_dashboard"]);
    setShowCreateForm(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!formName.trim()) return toast.error("Role name is required");
    try {
      await createRole.mutateAsync({ name: formName, description: formDesc, permissions: formPerms });
      toast.success("Custom role created");
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      await updateRole.mutateAsync({ id: editingId, name: formName, description: formDesc, permissions: formPerms });
      toast.success("Role updated");
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete custom role "${name}"? This cannot be undone.`)) return;
    try {
      await deleteRole.mutateAsync(id);
      toast.success("Role deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const startEditing = (role: { id: string; name: string; description: string | null; permissions: string[] }) => {
    setEditingId(role.id);
    setFormName(role.name);
    setFormDesc(role.description || "");
    setFormPerms(role.permissions);
    setShowCreateForm(true);
  };

  const togglePerm = (perm: string) => {
    setFormPerms(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  return (
    <DashboardLayout title="Roles & Permissions">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-primary">Roles & Permissions</h2>
        <p className="text-primary/40 text-sm mt-0.5">Manage system roles and create custom roles with granular permissions</p>
      </div>

      {/* System Roles */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={18} /> System Roles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {SYSTEM_ROLES.map(role => {
            const isExpanded = expandedRole === role;
            const perms = ROLE_PERMISSIONS[role] ?? [];
            return (
              <div key={role}>
                <button
                  onClick={() => setExpandedRole(isExpanded ? null : role)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10
                    hover:border-violet-500/20 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={ROLE_COLORS[role] || "info"}>{ROLE_LABELS[role]}</Badge>
                    <span className="text-primary/40 text-xs">{perms.length} permissions</span>
                  </div>
                  {isExpanded ? <ChevronUp size={14} className="text-primary/30" /> : <ChevronDown size={14} className="text-primary/30" />}
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-2 p-3 rounded-xl bg-primary/3 border border-primary/5">
                    <div className="flex flex-wrap gap-1.5">
                      {perms.map(p => (
                        <span key={p} className="px-2 py-0.5 bg-primary/5 rounded-md text-primary/50 text-xs">
                          {ALL_PERMISSIONS.find(ap => ap.key === p)?.label ?? p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Custom Roles */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle className="flex items-center gap-2">
              <Users size={18} /> Custom Roles
            </CardTitle>
            <Button size="sm" icon={<Plus size={13} />} onClick={() => { resetForm(); setShowCreateForm(true); }}>
              New Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-14 bg-primary/5 rounded-xl animate-pulse" />)}
            </div>
          ) : !customRoles?.length && !showCreateForm ? (
            <div className="text-center py-10">
              <Users size={40} className="mx-auto text-primary/20 mb-3" />
              <p className="text-primary/40 text-sm">No custom roles yet</p>
              <p className="text-primary/30 text-xs mt-1">Create a custom role with specific permissions for your team</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customRoles?.map(role => (
                <div key={role.id} className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{role.name}</Badge>
                        <span className="text-primary/40 text-xs">{role.permissions.length} permissions</span>
                      </div>
                      {role.description && (
                        <p className="text-primary/40 text-xs mt-1">{role.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEditing(role)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/40 hover:text-primary transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(role.id, role.name)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-primary/40 hover:text-rose-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {role.permissions.map(p => (
                      <span key={p} className="px-1.5 py-0.5 bg-primary/5 rounded text-primary/40 text-[10px]">
                        {ALL_PERMISSIONS.find(ap => ap.key === p)?.label ?? p}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-2xl border border-primary/10 p-6 max-h-[85vh] overflow-y-auto"
            style={{ background: "var(--bg-surface)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-primary">
                {editingId ? "Edit Custom Role" : "Create Custom Role"}
              </h3>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-primary/10 text-primary/40">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-primary/40 text-xs mb-1.5 block">Role Name *</label>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Senior Accountant"
                  className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm
                    text-primary focus:outline-none focus:border-violet-500/50 transition-all"
                />
              </div>

              <div>
                <label className="text-primary/40 text-xs mb-1.5 block">Description</label>
                <input
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm
                    text-primary focus:outline-none focus:border-violet-500/50 transition-all"
                />
              </div>

              <div>
                <label className="text-primary/40 text-xs mb-2 block">
                  Permissions ({formPerms.length} selected)
                </label>
                <div className="space-y-3">
                  {Object.entries(permissionGroups).map(([group, perms]) => (
                    <div key={group}>
                      <p className="text-primary/50 text-xs font-semibold mb-1.5">{group}</p>
                      <div className="grid grid-cols-1 gap-1">
                        {perms.map(perm => (
                          <button
                            key={perm.key}
                            onClick={() => togglePerm(perm.key)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all text-left ${
                              formPerms.includes(perm.key)
                                ? "bg-violet-600/20 text-violet-400 border border-violet-500/30"
                                : "bg-primary/5 text-primary/40 border border-primary/10 hover:border-primary/20"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              formPerms.includes(perm.key)
                                ? "bg-violet-600 border-violet-600"
                                : "border-primary/20"
                            }`}>
                              {formPerms.includes(perm.key) && <Check size={10} className="text-white" />}
                            </div>
                            {perm.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button onClick={editingId ? handleUpdate : handleCreate}
                  disabled={createRole.isPending || updateRole.isPending || !formName.trim()}
                  icon={editingId ? <Check size={14} /> : <Plus size={14} />}>
                  {editingId
                    ? (updateRole.isPending ? "Updating..." : "Update Role")
                    : (createRole.isPending ? "Creating..." : "Create Role")}
                </Button>
                <Button variant="secondary" onClick={resetForm}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
