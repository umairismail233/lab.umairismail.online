// ID Workbench v2 - Tasks & Deliverables View
// Restored element-for-element and interaction-for-interaction from original TasksPage and TaskDetailClient

window.allTasksCache = window.allTasksCache || [];
let cachedProjectsList = [];

async function renderTasksView(container, queryStr = '') {
  const params = new URLSearchParams(queryStr);
  const search = params.get('search') || '';
  const health = params.get('health') || '';
  const stage = params.get('stage') || '';
  const priority = params.get('priority') || '';
  const projectId = params.get('projectId') || '';

  const queryParams = new URLSearchParams();
  if (search) queryParams.set('search', search);
  if (health) queryParams.set('health', health);
  if (stage) queryParams.set('stage', stage);
  if (priority) queryParams.set('priority', priority);
  if (projectId) queryParams.set('projectId', projectId);

  try {
    const [tasks, projects] = await Promise.all([
      API.get(`api/tasks.php?${queryParams.toString()}`),
      API.get('api/projects.php')
    ]);

    allTasksCache = tasks || [];
    cachedProjectsList = projects || [];

    const hasActiveFilters = search || health || stage || priority || projectId;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              My Deliverables & Tasks
            </h1>
            <p class="text-xs text-slate-500 mt-1">
              Active instructional design work items, storyboards, modules, and QA targets. (${allTasksCache.length} displayed)
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="openQuickAddModal()" class="btn-primary text-xs py-2 px-3.5 inline-flex items-center gap-1.5">
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>New Work Item</span>
            </button>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="white-card p-4 space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
            <!-- Search input -->
            <div class="lg:col-span-2 relative">
              <input
                type="search"
                id="task-filter-search"
                value="${escapeHtml(search)}"
                placeholder="Search title, IDW-xxxx, course..."
                class="clean-input text-xs pl-8 w-full"
              />
              <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3 pointer-events-none"></i>
            </div>

            <!-- Project Filter -->
            <div>
              <select id="task-filter-project" class="clean-input text-xs w-full">
                <option value="">All Courses</option>
                ${cachedProjectsList.map(p => `
                  <option value="${p.id}" ${projectId === p.id ? 'selected' : ''}>
                    [${p.code}] ${p.name}
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Stage Filter -->
            <div>
              <select id="task-filter-stage" class="clean-input text-xs w-full">
                <option value="">All Stages</option>
                ${WORKFLOW_STAGES_FRONTEND.map(s => `
                  <option value="${s}" ${stage === s ? 'selected' : ''}>${s}</option>
                `).join('')}
              </select>
            </div>

            <!-- Health Filter -->
            <div>
              <select id="task-filter-health" class="clean-input text-xs w-full">
                <option value="">All Health States</option>
                <option value="attention" ${health === 'attention' ? 'selected' : ''}>Needs Attention</option>
                <option value="overdue" ${health === 'overdue' ? 'selected' : ''}>Overdue Only</option>
                <option value="blocked" ${health === 'blocked' ? 'selected' : ''}>Blocked Only</option>
                <option value="waiting" ${health === 'waiting' ? 'selected' : ''}>Waiting on SME</option>
                <option value="due_soon" ${health === 'due_soon' ? 'selected' : ''}>Due Soon</option>
              </select>
            </div>

            <!-- Submit / Reset Buttons -->
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                id="task-filter-apply-btn"
                onclick="applyTaskFilters()"
                class="btn-primary text-xs py-2 px-3 flex-1 inline-flex items-center justify-center gap-1"
              >
                <i data-lucide="filter" class="w-3.5 h-3.5"></i>
                <span>Filter</span>
              </button>
              ${hasActiveFilters ? `
                <button
                  type="button"
                  onclick="resetTaskFilters()"
                  class="btn-secondary text-xs py-2 px-2.5"
                  title="Reset filters"
                >
                  Reset
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Deliverables Table -->
        ${allTasksCache.length === 0 ? `
          <div class="white-card p-12 text-center space-y-3">
            <i data-lucide="check-circle-2" class="w-10 h-10 text-slate-400 mx-auto"></i>
            <h3 class="text-base font-semibold text-slate-900">No tasks match your filters</h3>
            <p class="text-xs text-slate-500 max-w-md mx-auto">
              Try adjusting your search criteria, or click below to create a new instructional deliverable.
            </p>
            <button
              onclick="openQuickAddModal()"
              class="btn-primary text-xs mt-2 inline-flex items-center gap-1.5"
            >
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>Create Deliverable</span>
            </button>
          </div>
        ` : `
          <div class="white-card overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th class="p-3.5 font-semibold">Deliverable & ID</th>
                    <th class="p-3.5 font-semibold">Course</th>
                    <th class="p-3.5 font-semibold">Workflow Stage</th>
                    <th class="p-3.5 font-semibold">Priority</th>
                    <th class="p-3.5 font-semibold">Health & Status</th>
                    <th class="p-3.5 font-semibold">Due Date</th>
                    <th class="p-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${allTasksCache.map(task => renderTaskRow(task)).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `}
      </div>
    `;

    // Bind Enter key on search input
    const searchInput = document.getElementById('task-filter-search');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyTaskFilters();
      });
    }

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-rose-600 text-xs">Failed to load tasks: ${err.message}</div>`;
  }
}

function renderTaskRow(task) {
  const healthBadge = renderHealthBadge(task.health);
  const priorityClass = task.priority === 'Urgent'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : task.priority === 'High'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-100 text-slate-700 border-slate-200';

  const dueDateFormatted = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';

  return `
    <tr class="hover:bg-slate-50/70 transition-colors group">
      <td class="p-3.5 max-w-xs">
        <div class="flex items-center gap-2">
          <span class="font-mono font-bold text-indigo-600">
            ${task.humanId}
          </span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
            ${task.workType || 'Module'}
          </span>
        </div>
        <button
          onclick="openTaskDetail('${task.id}')"
          class="font-semibold text-slate-900 group-hover:text-indigo-600 truncate block mt-0.5 hover:underline text-left w-full"
        >
          ${escapeHtml(task.title)}
        </button>
        ${task.moduleLesson ? `
          <span class="text-[11px] text-slate-500 block truncate">
            ${escapeHtml(task.moduleLesson)}
          </span>
        ` : ''}
      </td>

      <td class="p-3.5 text-slate-600">
        <span class="font-semibold block text-slate-800">
          ${task.projectCode}
        </span>
        <span class="text-[11px] text-slate-500 truncate block max-w-[140px]">
          ${escapeHtml(task.projectName)}
        </span>
      </td>

      <td class="p-3.5 text-slate-700">
        <span class="text-xs px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 inline-block font-medium text-slate-700">
          ${task.workflowStage}
        </span>
      </td>

      <td class="p-3.5">
        <span class="text-[10px] font-semibold px-2 py-0.5 rounded border ${priorityClass}">
          ${task.priority}
        </span>
      </td>

      <td class="p-3.5">
        <div class="space-y-1">
          ${healthBadge}
          ${task.isBlocked && task.blockerReason ? `
            <p class="text-[10px] text-rose-600 truncate max-w-[150px]">
              Blocker: ${escapeHtml(task.blockerReason)}
            </p>
          ` : ''}
        </div>
      </td>

      <td class="p-3.5 text-slate-600">
        <span class="font-medium font-mono text-[11px]">
          ${dueDateFormatted}
        </span>
      </td>

      <td class="p-3.5 text-right">
        <button
          onclick="openTaskDetail('${task.id}')"
          class="btn-secondary text-[11px] py-1 px-2.5 inline-flex items-center gap-1 hover:border-indigo-300"
        >
          <span>Inspect</span>
          <i data-lucide="arrow-right" class="w-3 h-3 text-slate-400"></i>
        </button>
      </td>
    </tr>
  `;
}

function applyTaskFilters() {
  const search = document.getElementById('task-filter-search')?.value.trim() || '';
  const projectId = document.getElementById('task-filter-project')?.value || '';
  const stage = document.getElementById('task-filter-stage')?.value || '';
  const health = document.getElementById('task-filter-health')?.value || '';

  const qp = new URLSearchParams();
  if (search) qp.set('search', search);
  if (projectId) qp.set('projectId', projectId);
  if (stage) qp.set('stage', stage);
  if (health) qp.set('health', health);

  window.location.hash = `tasks?${qp.toString()}`;
}

function resetTaskFilters() {
  window.location.hash = 'tasks';
}

const WORKFLOW_STAGES_FRONTEND = [
  "New SME Material Received", "Intake / Source Review", "Clarification Required",
  "Content Analysis", "Learning Design / Storyboarding", "Awaiting Internal Review",
  "Awaiting SME Review", "Revisions Required", "E-Learning Development",
  "QA / Functional Testing", "LMS / SCORM Preparation", "Ready for Delivery",
  "Delivered", "On Hold", "Cancelled"
];

// -------------------------------------------------------------
// Open Task Detail Drawer / Modal
// -------------------------------------------------------------
async function openTaskDetail(taskId) {
  const drawer = document.getElementById('task-detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const content = document.getElementById('task-detail-content');

  content.innerHTML = `<div class="p-8 text-center text-slate-400">Loading deliverable details...</div>`;
  drawer.classList.remove('translate-x-full');
  backdrop.classList.remove('hidden');

  try {
    const task = await API.get(`api/tasks.php?id=${taskId}`);

    content.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="pb-4 border-b border-slate-200 flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">${task.humanId}</span>
              <span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">${task.workType}</span>
              ${renderHealthBadge(task.health)}
            </div>
            <h2 class="text-lg font-bold text-slate-900">${escapeHtml(task.title)}</h2>
            <div class="text-xs text-slate-500 mt-0.5">Course: [${task.projectCode}] ${escapeHtml(task.projectName)}</div>
          </div>
          <button onclick="closeTaskDetail()" class="text-slate-400 hover:text-slate-700 p-1">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Stage & Blocker Control Card -->
        <div class="white-card p-4 space-y-3">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
            <span>Workflow Progression</span>
            <span class="text-[10px] font-mono text-slate-400">${task.progress || 0}% Progress</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-semibold text-slate-500 mb-1">Workflow Stage</label>
              <select id="detail-stage-select" class="clean-input text-xs w-full" onchange="updateTaskStage('${task.id}', this.value)">
                ${WORKFLOW_STAGES_FRONTEND.map(s => `<option value="${s}" ${task.workflowStage === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-slate-500 mb-1">Blocker Status</label>
              <button onclick="toggleTaskBlocker('${task.id}', ${task.isBlocked ? 0 : 1})" class="w-full ${task.isBlocked ? 'btn-danger' : 'btn-secondary'} text-xs py-2 inline-flex items-center justify-center gap-1.5">
                <i data-lucide="${task.isBlocked ? 'ban' : 'check-circle-2'}" class="w-3.5 h-3.5"></i>
                <span>${task.isBlocked ? 'Deliverable is Blocked' : 'Unblocked / On Track'}</span>
              </button>
            </div>
          </div>
          ${task.isBlocked ? `
            <div class="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-1.5">
              <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 shrink-0 mt-0.5"></i>
              <div>
                <span class="font-bold">Blocker Reason:</span>
                <p class="mt-0.5">${escapeHtml(task.blockerReason || 'Unspecified')}</p>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- 12-Point QA Delivery Gate Checklist -->
        <div class="white-card p-4 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <i data-lucide="shield-check" class="w-4 h-4 text-indigo-600"></i>
                <span>12-Point QA Delivery Gate</span>
              </div>
              <p class="text-[11px] text-slate-400">All points must pass before dispatching SCORM or LMS package.</p>
            </div>
            <button onclick="openDeliveryModal('${task.id}')" class="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1">
              <i data-lucide="package-check" class="w-3.5 h-3.5"></i>
              <span>Ship Package</span>
            </button>
          </div>

          <div class="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            ${(task.qaChecks || []).map(qc => `
              <div class="py-2 flex items-center justify-between gap-3 text-xs">
                <div class="min-w-0 flex-1">
                  <div class="font-semibold text-slate-900">${qc.title}</div>
                  <div class="text-[10px] text-slate-400 uppercase tracking-wider font-mono">${qc.category}</div>
                </div>
                <div class="flex items-center gap-2">
                  <select onchange="updateQACheck('${qc.id}', this.value)" class="clean-input text-[11px] py-1 max-w-[120px]">
                    <option value="Not started" ${qc.status === 'Not started' ? 'selected' : ''}>Not started</option>
                    <option value="Pass" ${qc.status === 'Pass' ? 'selected' : ''}>Pass</option>
                    <option value="Needs fix" ${qc.status === 'Needs fix' ? 'selected' : ''}>Needs fix</option>
                    <option value="Not applicable" ${qc.status === 'Not applicable' ? 'selected' : ''}>N/A</option>
                  </select>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Review Cycles -->
        <div class="white-card p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <i data-lucide="git-pull-request" class="w-4 h-4 text-indigo-600"></i>
              <span>Review Cycles</span>
            </div>
            <button onclick="promptNewReview('${task.id}')" class="btn-secondary text-[11px] py-1 px-2.5 inline-flex items-center gap-1">
              <i data-lucide="plus" class="w-3 h-3"></i>
              <span>Request Review</span>
            </button>
          </div>
          <div class="space-y-2">
            ${(task.reviews || []).length === 0 ? '<div class="text-xs text-slate-400 py-3 text-center">No reviews requested yet.</div>' : ''}
            ${(task.reviews || []).map(r => `
              <div class="p-3 rounded border border-slate-200/80 bg-slate-50/50 text-xs">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-bold text-slate-900">${r.reviewType} Review by ${escapeHtml(r.reviewerName)}</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-semibold border ${r.outcome === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}">${r.outcome}</span>
                </div>
                ${r.feedbackSummary ? `<p class="text-[11px] text-slate-600 mt-1">${escapeHtml(r.feedbackSummary)}</p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    content.innerHTML = `<div class="p-6 text-rose-600 text-xs">${err.message}</div>`;
  }
}

function closeTaskDetail() {
  const drawer = document.getElementById('task-detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  if (drawer) drawer.classList.add('translate-x-full');
  if (backdrop) backdrop.classList.add('hidden');
}

async function updateTaskStage(taskId, newStage) {
  try {
    await API.post('api/tasks.php?action=update_stage', { id: taskId, workflowStage: newStage });
    Toast.success(`Stage moved to ${newStage}`);
    if (window.location.hash.startsWith('#tasks') || window.location.hash === '') {
      renderTasksView(document.getElementById('view-container'), window.location.hash.split('?')[1] || '');
    }
  } catch (err) {
    Toast.error(err.message);
  }
}

async function toggleTaskBlocker(taskId, isBlocked) {
  let reason = null;
  if (isBlocked) {
    reason = prompt('Enter the blocker reason (e.g. Awaiting SME clarification, Audio re-recording):');
    if (!reason) return;
  }
  try {
    await API.post('api/tasks.php?action=toggle_block', { id: taskId, isBlocked, blockerReason: reason });
    Toast.success(isBlocked ? 'Task flagged as Blocked' : 'Task unblocked');
    openTaskDetail(taskId);
    if (window.location.hash.startsWith('#tasks') || window.location.hash === '') {
      renderTasksView(document.getElementById('view-container'), window.location.hash.split('?')[1] || '');
    }
  } catch (err) {
    Toast.error(err.message);
  }
}

async function updateQACheck(checkId, status) {
  try {
    await API.post('api/qa.php?action=update_item', { id: checkId, status });
    Toast.success('QA item updated');
  } catch (err) {
    Toast.error(err.message);
  }
}

function promptNewReview(taskId) {
  const reviewerName = prompt('Enter Reviewer Name:');
  if (!reviewerName) return;
  const reviewType = confirm('Is this an SME Review? (Click OK for SME, Cancel for Internal)') ? 'SME' : 'Internal';
  API.post('api/reviews.php', { workItemId: taskId, reviewerName, reviewType })
    .then(() => {
      Toast.success('Review cycle initiated');
      openTaskDetail(taskId);
    })
    .catch(err => Toast.error(err.message));
}

function openDeliveryModal(taskId) {
  const format = prompt('Delivery Package Format (e.g. SCORM 1.2, SCORM 2004, Web HTML5):', 'SCORM 1.2');
  if (!format) return;
  const destination = prompt('Destination LMS / Staging location:', 'LMS Production');
  if (!destination) return;

  API.post('api/qa.php?action=record_delivery', {
    taskId,
    deliveryFormat: format,
    packageVersion: '1.0.0',
    destination
  }).then(() => {
    Toast.success('Package marked as Delivered and Completed!');
    openTaskDetail(taskId);
    if (window.location.hash.startsWith('#tasks') || window.location.hash === '') {
      renderTasksView(document.getElementById('view-container'), window.location.hash.split('?')[1] || '');
    }
  }).catch(err => Toast.error(err.message));
}
