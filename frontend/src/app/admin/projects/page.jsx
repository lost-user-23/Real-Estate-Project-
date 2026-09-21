"use client";

import { useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { formatPrice } from "@/lib/format";
import { StatusPill } from "@/components/admin/StatusPill";
import { Modal } from "@/components/admin/Modal";
import { AddProjectForm } from "@/components/admin/forms/AddProjectForm";

export default function AdminProjectsPage() {
  const { projects, setProjectStatus, deleteProject } = useAdminStore();
  const [showAdd, setShowAdd] = useState(false);

  const handleDelete = (project) => {
    if (window.confirm(`Delete "${project.name}"? This can't be undone.`)) {
      deleteProject(project.id);
    }
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
                    {project.locality}, {project.city}
                  </p>
                </td>
                <td className="px-4 py-3 text-text-muted">{project.developer}</td>
                <td className="px-4 py-3">{formatPrice(project.startingPriceInRupees)}</td>
                <td className="px-4 py-3 text-text-muted">{project.publishedAt}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusPill status={project.status} />
                    <select
                      value={project.status}
                      onChange={(e) => setProjectStatus(project.id, e.target.value)}
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
                  <button
                    type="button"
                    onClick={() => handleDelete(project)}
                    className="text-xs font-medium text-danger hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  No projects yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showAdd ? (
        <Modal title="Add project" onClose={() => setShowAdd(false)}>
          <AddProjectForm onDone={() => setShowAdd(false)} />
        </Modal>
      ) : null}
    </div>
  );
}
