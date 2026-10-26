// ID Workbench v2 - Projects & Courses View
// Restored element-for-element and interaction-for-interaction from original ProjectsClient.tsx and ProjectDetailClient.tsx

let cachedProjectsData = [];

async function renderProjectsView(container, queryStr = '') {
  const params = new URLSearchParams(queryStr);
  const projectId = params.get('id');

  if (projectId) {
    return renderProjectDetailView(container, projectId);
  }

  try {
    const projects = await API.get('api/projects.php');
    cachedProjectsData = projects || [];

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <i data-lucide="folder-git-2" class="w-5 h-5 text-indigo-600"></i>
              <span>Projects & Courses (${cachedProjectsData.length})</span>
            </h1>
            <p class="text-xs text-slate-500 mt-1">
              Curriculum programs, compliance series, and accredited e-learning projects.
            </p>
          </div>

          <button
            onclick="openNewProjectModal()"
            class="btn-primary text-xs py-2 px-3.5 inline-flex items-center gap-1.5"
          >
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>New Course / Project</span>
          </button>
        </div>

        <!-- Projects Grid -->
        ${cachedProjectsData.length === 0 ? `
          <div class="white-card p-12 text-center space-y-3">
            <i data-lucide="folder-git-2" class="w-10 h-10 text-slate-400 mx-auto"></i>
            <h3 class="text-base font-semibold text-slate-900">No courses created yet</h3>
            <p class="text-xs text-slate-500 max-w-md mx-auto">
              Create your first instructional project or course to begin organizing deliverables and SME intake materials.
            </p>
            <button onclick="openNewProjectModal()" class="btn-primary text-xs mt-2">
              Create Course
            </button>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${cachedProjectsData.map(proj => renderProjectCard(proj)).join('')}
          </div>
        `}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-rose-600 text-xs">Failed to load projects: ${err.message}</div>`;
  }
}

function renderProjectCard(proj) {
  const health = proj.healthInfo || { health: 'Healthy', completionRate: 0 };
  const healthClass = health.health === 'Healthy'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : health.health === 'At Risk'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';

  const targetDateStr = proj.targetDeliveryDate ? new Date(proj.targetDeliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';

  return `
    <div
      onclick="navigateToProjectDetail('${proj.id}')"
      class="white-card p-5 space-y-4 hover:border-indigo-400 block transition-all group cursor-pointer"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <span class="font-mono text-xs font-bold text-indigo-600 block">
            ${proj.code}
          </span>
          <h3 class="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate mt-0.5">
            ${escapeHtml(proj.name)}
          </h3>
          ${proj.clientDepartment ? `
            <p class="text-xs text-slate-500 truncate mt-0.5">
              ${escapeHtml(proj.clientDepartment)}
            </p>
          ` : ''}
        </div>

        <span class="text-[10px] px-2 py-0.5 rounded font-semibold shrink-0 border ${healthClass}">
          ${health.health}
        </span>
      </div>

      ${proj.description ? `
        <p class="text-xs text-slate-600 line-clamp-2">
          ${escapeHtml(proj.description)}
        </p>
      ` : ''}

      <!-- Progress Bar -->
      <div class="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
        <div class="flex items-center justify-between text-slate-500 text-[11px]">
          <span>Deliverables Completed</span>
          <span class="font-bold text-slate-900">${proj.completedTasks || 0} / ${proj.totalTasks || 0} (${health.completionRate || 0}%)</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div class="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style="width: ${health.completionRate || 0}%"></div>
        </div>

        <div class="flex items-center justify-between pt-1 text-[11px] text-slate-500">
          <span class="flex items-center gap-1">
            <i data-lucide="calendar" class="w-3 h-3 text-slate-400"></i>
            <span>Target: ${targetDateStr}</span>
          </span>
          <span class="text-indigo-600 font-medium group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
            <span>Details</span>
            <i data-lucide="arrow-right" class="w-3 h-3"></i>
          </span>
        </div>
      </div>
    </div>
  `;
}

function navigateToProjectDetail(id) {
  window.location.hash = `projects?id=${id}`;
}

async function renderProjectDetailView(container, projectId) {
  try {
    const proj = await API.get(`api/projects.php?id=${projectId}`);
    const health = proj.healthInfo || { health: 'Healthy', completionRate: 0, reason: '' };

    const healthClass = health.health === 'Healthy'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : health.health === 'At Risk'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-rose-50 text-rose-700 border-rose-200';

    const startDateStr = proj.startDate ? new Date(proj.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const targetDateStr = proj.targetDeliveryDate ? new Date(proj.targetDeliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Top Breadcrumb -->
        <div class="flex items-center justify-between">
          <a
            href="#projects"
            class="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1.5 transition-colors font-medium"
          >
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            <span>Back to Projects & Courses</span>
          </a>
        </div>

        <!-- Main Header Card -->
        <div class="white-card p-5 sm:p-6 space-y-4">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono text-xs font-bold text-indigo-600">
                  ${proj.code}
                </span>
                ${proj.clientDepartment ? `
                  <span class="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    ${escapeHtml(proj.clientDepartment)}
                  </span>
                ` : ''}
                <span class="text-xs px-2.5 py-0.5 rounded font-semibold border ${healthClass}">
                  ${health.health}
                </span>
              </div>
              <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                ${escapeHtml(proj.name)}
              </h1>
              ${proj.description ? `<p class="text-xs text-slate-600 max-w-3xl">${escapeHtml(proj.description)}</p>` : ''}
            </div>
          </div>

          <!-- Metadata Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
            <div>
              <span class="text-slate-400 block text-[11px]">Start Date</span>
              <span class="font-semibold text-slate-800">${startDateStr}</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[11px]">Target Delivery</span>
              <span class="font-semibold text-slate-800">${targetDateStr}</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[11px]">Lead SME</span>
              <span class="font-semibold text-slate-800">${escapeHtml(proj.smeName || 'Unassigned')}</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[11px]">Completion Rate</span>
              <span class="font-bold text-indigo-600">${health.completionRate || 0}%</span>
            </div>
          </div>
        </div>

        <!-- Milestones Section -->
        <div class="white-card p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2">
              <i data-lucide="flag" class="w-4 h-4 text-indigo-600"></i>
              <h3 class="text-sm font-bold text-slate-900">Project Milestones (${(proj.milestones || []).length})</h3>
            </div>
            <button onclick="promptAddMilestone('${proj.id}')" class="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1">
              <i data-lucide="plus" class="w-3 h-3"></i>
              <span>Add Milestone</span>
            </button>
          </div>

          <div class="divide-y divide-slate-100">
            ${(proj.milestones || []).length === 0 ? '<div class="text-xs text-slate-400 py-4 text-center">No milestones created yet.</div>' : ''}
            ${(proj.milestones || []).map(m => `
              <div class="py-2.5 flex items-center justify-between text-xs gap-3">
                <div class="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    ${m.isCompleted ? 'checked' : ''}
                    onchange="toggleMilestone('${m.id}', this.checked, '${proj.id}')"
                    class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span class="${m.isCompleted ? 'line-through text-slate-400' : 'font-medium text-slate-800'}">
                    ${escapeHtml(m.title)}
                  </span>
                </div>
                <span class="text-slate-500 font-mono text-[11px]">
                  ${m.targetDate ? new Date(m.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Deliverables Section -->
        <div class="white-card p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2">
              <i data-lucide="layers" class="w-4 h-4 text-indigo-600"></i>
              <h3 class="text-sm font-bold text-slate-900">Course Deliverables (${(proj.workItems || []).length})</h3>
            </div>
            <button onclick="openQuickAddModal()" class="btn-primary text-xs py-1 px-2.5 inline-flex items-center gap-1">
              <i data-lucide="plus" class="w-3 h-3"></i>
              <span>New Deliverable</span>
            </button>
          </div>

          <div class="divide-y divide-slate-100">
            ${(proj.workItems || []).length === 0 ? '<div class="text-xs text-slate-400 py-4 text-center">No deliverables associated with this project.</div>' : ''}
            ${(proj.workItems || []).map(t => `
              <div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div class="space-y-0.5">
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-indigo-600">${t.humanId}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${t.workType}</span>
                    ${renderHealthBadge(t.health)}
                  </div>
                  <button onclick="openTaskDetail('${t.id}')" class="font-semibold text-slate-900 hover:text-indigo-600 text-left hover:underline">
                    ${escapeHtml(t.title)}
                  </button>
                </div>
                <div class="flex items-center gap-2 self-start sm:self-center">
                  <span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">${t.workflowStage}</span>
                  <button onclick="openTaskDetail('${t.id}')" class="btn-secondary text-[11px] py-1 px-2">Inspect</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-rose-600 text-xs">Failed to load project details: ${err.message}</div>`;
  }
}

async function toggleMilestone(milestoneId, isCompleted, projectId) {
  try {
    await API.post('api/projects.php?action=toggle_milestone', {
      id: milestoneId,
      isCompleted: isCompleted ? 1 : 0
    });
    Toast.success(isCompleted ? 'Milestone marked as complete' : 'Milestone reopened');
    renderProjectDetailView(document.getElementById('view-container'), projectId);
  } catch (err) {
    Toast.error(err.message || 'Failed to update milestone');
  }
}

function promptAddMilestone(projectId) {
  const title = prompt('Milestone Title (e.g. Storyboard Approval Sign-Off):');
  if (!title) return;
  const targetDate = prompt('Target Completion Date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
  if (!targetDate) return;

  API.post('api/projects.php?action=add_milestone', {
    projectId,
    title,
    targetDate
  }).then(() => {
    Toast.success('Milestone added successfully');
    renderProjectDetailView(document.getElementById('view-container'), projectId);
  }).catch(err => Toast.error(err.message));
}

// -------------------------------------------------------------
// New Course / Project Modal
// -------------------------------------------------------------
function openNewProjectModal() {
  let modal = document.getElementById('new-project-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'new-project-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="white-card p-6 max-w-lg w-full shadow-2xl space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
          <i data-lucide="folder-git-2" class="w-4 h-4 text-indigo-600"></i>
          <span>Create New Course / Project</span>
        </h3>
        <button onclick="closeNewProjectModal()" class="text-slate-400 hover:text-slate-600">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <form id="new-project-form" onsubmit="handleCreateProjectSubmit(event)" class="space-y-3.5 text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Project Code *</label>
            <input
              type="text"
              id="proj-new-code"
              required
              placeholder="e.g. PRJ-SEC-2026"
              class="clean-input w-full uppercase"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Client Department</label>
            <input
              type="text"
              id="proj-new-dept"
              placeholder="e.g. Information Security"
              class="clean-input w-full"
            />
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Course / Project Title *</label>
          <input
            type="text"
            id="proj-new-name"
            required
            placeholder="e.g. Global Cybersecurity & Phishing Defense"
            class="clean-input w-full"
          />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Description & Target Objectives</label>
          <textarea
            id="proj-new-desc"
            rows="2"
            placeholder="Course scope, accredited syllabus requirements, or audience notes..."
            class="clean-input w-full"
          ></textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              id="proj-new-start"
              class="clean-input w-full"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Target Delivery Date</label>
            <input
              type="date"
              id="proj-new-target"
              class="clean-input w-full"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Lead SME Name</label>
            <input
              type="text"
              id="proj-new-sme-name"
              placeholder="e.g. Marcus Vance"
              class="clean-input w-full"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Lead SME Email</label>
            <input
              type="email"
              id="proj-new-sme-email"
              placeholder="e.g. mvance@company.internal"
              class="clean-input w-full"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <button type="button" onclick="closeNewProjectModal()" class="btn-secondary text-xs">
            Cancel
          </button>
          <button type="submit" class="btn-primary text-xs">
            Create Course
          </button>
        </div>
      </form>
    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeNewProjectModal() {
  const modal = document.getElementById('new-project-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleCreateProjectSubmit(e) {
  e.preventDefault();
  const code = document.getElementById('proj-new-code').value.trim();
  const name = document.getElementById('proj-new-name').value.trim();
  const clientDepartment = document.getElementById('proj-new-dept').value.trim();
  const description = document.getElementById('proj-new-desc').value.trim();
  const startDate = document.getElementById('proj-new-start').value;
  const targetDeliveryDate = document.getElementById('proj-new-target').value;
  const smeName = document.getElementById('proj-new-sme-name').value.trim();
  const smeEmail = document.getElementById('proj-new-sme-email').value.trim();

  try {
    await API.post('api/projects.php', {
      code,
      name,
      clientDepartment,
      description,
      startDate: startDate || null,
      targetDeliveryDate: targetDeliveryDate || null,
      smeName,
      smeEmail,
      status: 'Active'
    });
    Toast.success('Course / Project created successfully');
    closeNewProjectModal();
    renderProjectsView(document.getElementById('view-container'));
  } catch (err) {
    Toast.error(err.message || 'Failed to create course');
  }
}
