"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { useAttempt } from "@/lib/attempt";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { formatDate, formatPrice } from "@/lib/format";
import { Pagination } from "@/components/admin/Pagination";
import { StatusPill } from "@/components/admin/StatusPill";
import { Modal } from "@/components/admin/Modal";
import { AddProjectForm } from "@/components/admin/forms/AddProjectForm";

const PAGE_SIZE = 20;

export default function AdminProjectsPage() {
  const { projects, projectsMeta, projectsLoading, projectsError, loadProjects, setProjectStatus, deleteProject } =
    useAdminStore();
  const attempt = useAttempt();
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);

  const reload = useCallback(() => loadProjects({ page, limit: PAGE_SIZE }), [loadProjects, page]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleStatusChange = async (project, status) => {
    const res = await attempt(() => setProjectStatus(project.id, status));
    if (res.ok) reload();
  };

  const handleDelete = async (project) => {
    const ok = await confirm({
      title: "Delete project?",
      message: `Delete "${project.name}"? This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const res = await attempt(() => deleteProject(project.id));
    if (!res.ok) return;
    if (projects.length <= 1 && page > 1) setPage((p) => p - 1);
    else reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New projects</h1>
          <p className="mt-1 text-sm text-text-muted">
            The home page shows up to 4 published projects, most recently published first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Add project
        </button>
      </div>

      {projectsError ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger px-4 py-3 text-sm text-danger">
          <span>Could not load projects: {projectsError}</span>
          <button type="button" onClick={reload} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-180 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Developer</th>
              <th className="px-4 py-3 font-medium">Starting price</th>
              <th className="px-4 py-3 font-medium">Published</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{project.name}</p>
                  <p className="text-xs text-text-muted">
                    {[project.locality, project.city].filter(Boolean).join(", ")}
                  </p>
                </td>
                <td className="px-4 py-3 text-text-muted">{project.developer}</td>
                <td className="px-4 py-3">{formatPrice(project.startingPriceInRupees)}</td>
                <td className="px-4 py-3 text-text-muted">{project.publishedAt ? formatDate(project.publishedAt) : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusPill status={project.status} />
                    <select
                      value={project.status}
                      onChange={(e) => handleStatusChange(project, e.target.value)}
                      aria-label={`Status for ${project.name}`}
                      className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditing(project)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(project)}
                      className="text-xs font-medium text-danger hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {projectsLoading && projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  Loading projects…
                </td>
              </tr>
            ) : null}
            {!projectsLoading && !projectsError && projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  No projects yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination meta={projectsMeta} label="projects" loading={projectsLoading} page={page} onPageChange={setPage} />

      {showAdd ? (
        <Modal title="Add project" onClose={() => setShowAdd(false)}>
          <AddProjectForm
            onDone={() => {
              setShowAdd(false);
              if (page === 1) reload();
              else setPage(1);
            }}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Edit project" onClose={() => setEditing(null)}>
          <AddProjectForm
            item={editing}
            onDone={() => {
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
