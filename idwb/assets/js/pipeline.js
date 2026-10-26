// ID Workbench v2 - Restored 15-Stage Pedagogical Kanban Pipeline
let pipelineSelectedProject = '';
let pipelineSelectedPriority = '';

async function renderPipelineView(container, queryStr) {
  if (queryStr) {
    const params = new URLSearchParams(queryStr);
    if (params.has('projectId')) pipelineSelectedProject = params.get('projectId');
    if (params.has('priority')) pipelineSelectedPriority = params.get('priority');
  }

  const [data, projectsData] = await Promise.all([
    API.get('api/pipeline.php'),
    API.get('api/projects.php')
  ]);

  const pipeline = data.pipeline || [];
  const projects = Array.isArray(projectsData) ? projectsData : (projectsData.projects || []);

  // Filter tasks in pipeline according to filters
  const filteredPipeline = pipeline.map(col => {
    let tasks = col.tasks || [];
    if (pipelineSelectedProject) {
      tasks = tasks.filter(t => t.projectId === pipelineSelectedProject);
    }
    if (pipelineSelectedPriority) {
      tasks = tasks.filter(t => t.priority === pipelineSelectedPriority);
    }
    return {
      stage: col.stage,
      count: tasks.length,
      tasks
    };
  });

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header & Filter Controls -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <i data-lucide="kanban" class="w-5 h-5 text-indigo-600"></i>
            Work Pipeline (15 Pedagogical Stages)
          </h1>
          <p class="text-xs text-slate-500 mt-1">
            Trace instructional deliverables from SME intake, content analysis, storyboarding to LMS packaging and delivery.
          </p>
        </div>

        <!-- Filter Dropdowns -->
        <div class="flex items-center gap-2 flex-wrap">
          <select
            id="pipe-filter-project"
            onchange="handlePipelineFilterChange()"
            class="clean-input text-xs py-1.5 w-auto"
          >
            <option value="">All Courses</option>
            ${projects.map(p => `
              <option value="${p.id}" ${p.id === pipelineSelectedProject ? 'selected' : ''}>[${p.code}] ${p.name}</option>
            `).join('')}
          </select>

          <select
            id="pipe-filter-priority"
            onchange="handlePipelineFilterChange()"
            class="clean-input text-xs py-1.5 w-auto"
          >
            <option value="">All Priorities</option>
            <option value="Urgent" ${pipelineSelectedPriority === 'Urgent' ? 'selected' : ''}>Urgent</option>
            <option value="High" ${pipelineSelectedPriority === 'High' ? 'selected' : ''}>High</option>
            <option value="Normal" ${pipelineSelectedPriority === 'Normal' ? 'selected' : ''}>Normal</option>
            <option value="Low" ${pipelineSelectedPriority === 'Low' ? 'selected' : ''}>Low</option>
          </select>
        </div>
      </div>

      <!-- Horizontal 15-Stage Columns -->
      <div class="flex gap-4 overflow-x-auto pb-6 pt-1">
        ${filteredPipeline.map((col, idx) => `
          <div class="kanban-column shrink-0" data-stage="${col.stage}" ondragover="handleDragOver(event)" ondrop="handleDrop(event, '${col.stage}')">
            
            <!-- Stage Header -->
            <div class="p-3.5 bg-white border-b border-slate-200 rounded-t-xl">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-mono font-bold uppercase text-indigo-700 tracking-wider">
                  STAGE ${idx + 1}
                </span>
                <span class="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center font-mono">
                  ${col.count}
                </span>
              </div>
              <h3 class="font-bold text-xs text-slate-900 truncate" title="${col.stage}">
                ${col.stage}
              </h3>
            </div>

            <!-- Column Body -->
            <div class="kanban-body">
              ${col.tasks.length === 0 ? `
                <div class="h-32 flex items-center justify-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white/50">
                  Empty Stage
                </div>
              ` : `
                ${col.tasks.map(t => `
                  <div
                    draggable="true"
                    ondragstart="handleDragStart(event, '${t.id}')"
                    onclick="openTaskDetail('${t.id}')"
                    class="white-card-interactive p-3.5 space-y-2.5 block group ${t.isBlocked ? 'border-l-4 border-l-rose-500' : ''}"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-mono text-xs font-bold text-indigo-700 group-hover:underline">
                        ${t.humanId}
                      </span>
                      <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                        ${t.projectCode || ''}
                      </span>
                    </div>

                    <h4 class="text-xs font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors line-clamp-2">
                      ${t.title}
                    </h4>

                    ${t.isBlocked ? `
                      <div class="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] leading-tight">
                        <span class="font-bold flex items-center gap-1">
                          <i data-lucide="ban" class="w-3 h-3 text-rose-600"></i> Blocked:
                        </span>
                        <p class="mt-0.5 truncate">${t.blockerReason || 'Waiting on clarification'}</p>
                      </div>
                    ` : ''}

                    <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                      <span class="${
                        t.priority === 'Urgent' ? 'text-rose-700 font-bold' :
                        t.priority === 'High' ? 'text-amber-700 font-bold' :
                        'text-slate-500'
                      }">
                        ${t.priority}
                      </span>
                      <span class="text-slate-400 font-medium">${formatDateShort(t.dueDate)}</span>
                    </div>
                  </div>
                `).join('')}
              `}
            </div>

          </div>
        `).join('')}
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function handlePipelineFilterChange() {
  const proj = document.getElementById('pipe-filter-project').value;
  const prio = document.getElementById('pipe-filter-priority').value;
  pipelineSelectedProject = proj;
  pipelineSelectedPriority = prio;

  const params = new URLSearchParams();
  if (proj) params.set('projectId', proj);
  if (prio) params.set('priority', prio);

  window.location.hash = `pipeline?${params.toString()}`;
}

let draggedTaskId = null;

function handleDragStart(e, taskId) {
  draggedTaskId = taskId;
  e.dataTransfer.setData('text/plain', taskId);
}

function handleDragOver(e) {
  e.preventDefault();
}

async function handleDrop(e, targetStage) {
  e.preventDefault();
  if (!draggedTaskId) return;

  try {
    await API.post('api/pipeline.php', {
      taskId: draggedTaskId,
      targetStage
    });
    Toast.success(`Moved to "${targetStage}"`);
    renderPipelineView(document.getElementById('view-container'));
  } catch (err) {
    Toast.error(err.message || 'Failed to move deliverable');
  } finally {
    draggedTaskId = null;
  }
}
