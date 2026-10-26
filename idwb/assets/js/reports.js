// ID Workbench v2 - Reports & Analytics View
// Restored element-for-element and interaction-for-interaction from original ReportsPage and ReportsClient

async function renderReportsView(container) {
  try {
    const [data, tasks, sme] = await Promise.all([
      API.get('api/reports.php'),
      API.get('api/tasks.php'),
      API.get('api/sme.php')
    ]);

    const { overview, stageDistribution, byWorkType, bottlenecks } = data;
    const allTasks = tasks || [];
    const allIntakes = sme || [];

    let totalEst = 0;
    let totalAct = 0;
    allTasks.forEach(t => {
      if (t.estimatedHours) totalEst += parseFloat(t.estimatedHours);
      if (t.actualHours) totalAct += parseFloat(t.actualHours);
    });

    const variance = Math.round((totalAct - totalEst) * 10) / 10;
    const convertedIntakes = allIntakes.filter(i => i.isConverted).length;
    const conversionRate = allIntakes.length > 0 ? Math.round((convertedIntakes / allIntakes.length) * 100) : 0;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <i data-lucide="bar-chart-3" class="w-5 h-5 text-indigo-600"></i>
              <span>Instructional Design Analytics & Reports</span>
            </h1>
            <p class="text-xs text-slate-500 mt-1">
              Cross-project velocity, effort variances, SME conversion ratios, and delivery statistics.
            </p>
          </div>

          <div class="flex items-center gap-2 flex-wrap text-xs">
            <a
              href="api/export.php?type=tasks"
              class="btn-primary text-xs py-2 px-3 inline-flex items-center gap-1.5"
            >
              <i data-lucide="download" class="w-4 h-4"></i>
              <span>Export Deliverables CSV</span>
            </a>
            <a
              href="api/export.php?type=sme"
              class="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5"
            >
              <i data-lucide="download" class="w-4 h-4"></i>
              <span>Export SME Intake CSV</span>
            </a>
          </div>
        </div>

        <!-- KPI Metric Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="white-card p-4">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Deliverables</div>
            <div class="text-2xl font-extrabold text-slate-900 mt-1">${overview.totalTasks}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Across all active courses</div>
          </div>
          <div class="white-card p-4">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Delivered & Shipped</div>
            <div class="text-2xl font-extrabold text-emerald-700 mt-1">${overview.deliveredTasks}</div>
            <div class="text-[11px] text-emerald-600 mt-0.5">${overview.completionRate}% completion rate</div>
          </div>
          <div class="white-card p-4">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Active in Production</div>
            <div class="text-2xl font-extrabold text-indigo-700 mt-1">${overview.inProgressTasks}</div>
            <div class="text-[11px] text-indigo-600 mt-0.5">In flight across stages</div>
          </div>
          <div class="white-card p-4">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Active Blockers</div>
            <div class="text-2xl font-extrabold text-rose-700 mt-1">${overview.blockedTasks}</div>
            <div class="text-[11px] text-rose-600 mt-0.5">Items requiring resolution</div>
          </div>
        </div>

        <!-- Effort & SME Intake Funnel Row -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Effort Analysis Card -->
          <div class="white-card p-5 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 class="text-sm font-bold text-slate-900 uppercase tracking-wide">Production Effort Telemetry</h2>
              <span class="text-xs font-mono font-bold ${variance > 0 ? 'text-amber-600' : 'text-emerald-600'}">
                Variance: ${variance > 0 ? `+${variance}h` : `${variance}h`}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-4 text-xs">
              <div class="p-3 rounded bg-slate-50 border border-slate-200">
                <span class="text-slate-400 block text-[11px]">Total Estimated Hours</span>
                <span class="text-xl font-bold text-slate-900 mt-0.5 block">${Math.round(totalEst * 10) / 10}h</span>
              </div>
              <div class="p-3 rounded bg-slate-50 border border-slate-200">
                <span class="text-slate-400 block text-[11px]">Total Logged Actual Hours</span>
                <span class="text-xl font-bold text-slate-900 mt-0.5 block">${Math.round(totalAct * 10) / 10}h</span>
              </div>
            </div>
            <p class="text-xs text-slate-500">
              Instructional design velocity index tracks actual logged development hours against initial scoping estimates.
            </p>
          </div>

          <!-- SME Intake Funnel Card -->
          <div class="white-card p-5 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 class="text-sm font-bold text-slate-900 uppercase tracking-wide">SME Source Intake Funnel</h2>
              <span class="text-xs font-bold text-indigo-600">${conversionRate}% Converted</span>
            </div>
            <div class="grid grid-cols-3 gap-3 text-xs">
              <div class="p-3 rounded bg-slate-50 border border-slate-200 text-center">
                <span class="text-slate-400 block text-[10px] uppercase font-semibold">Total Logged</span>
                <span class="text-xl font-bold text-slate-900 mt-0.5 block">${allIntakes.length}</span>
              </div>
              <div class="p-3 rounded bg-indigo-50/50 border border-indigo-200 text-center">
                <span class="text-indigo-600 block text-[10px] uppercase font-semibold">Converted</span>
                <span class="text-xl font-bold text-indigo-700 mt-0.5 block">${convertedIntakes}</span>
              </div>
              <div class="p-3 rounded bg-emerald-50/50 border border-emerald-200 text-center">
                <span class="text-emerald-700 block text-[10px] uppercase font-semibold">Conversion Rate</span>
                <span class="text-xl font-bold text-emerald-800 mt-0.5 block">${conversionRate}%</span>
              </div>
            </div>
            <p class="text-xs text-slate-500">
              Conversion ratio measuring raw SME drafts that successfully pass review and become active course deliverables.
            </p>
          </div>
        </div>

        <!-- 15-Stage Distribution & Bottlenecks Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Stage Distribution -->
          <div class="white-card p-5 space-y-4">
            <h2 class="text-sm font-bold text-slate-900 uppercase tracking-wide">15-Stage Pipeline Distribution</h2>
            <div class="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 text-xs">
              ${stageDistribution.map(s => `
                <div>
                  <div class="flex items-center justify-between text-xs mb-1">
                    <span class="font-medium text-slate-700 truncate pr-2">${s.stage}</span>
                    <span class="font-mono font-bold text-slate-900">${s.count}</span>
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${overview.totalTasks > 0 ? (s.count / overview.totalTasks) * 100 : 0}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Bottleneck Alerts -->
          <div class="white-card p-5 space-y-4">
            <h2 class="text-sm font-bold text-slate-900 uppercase tracking-wide">Production Bottlenecks & Inactive Tasks</h2>
            <div class="space-y-2.5">
              ${bottlenecks.length === 0 ? '<div class="py-12 text-center text-xs text-slate-400">No bottlenecks detected. Production velocity is optimal!</div>' : ''}
              ${bottlenecks.map(b => `
                <div onclick="openTaskDetail('${b.id}')" class="p-3 rounded-lg border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-between">
                  <div class="min-w-0 pr-3">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-mono font-bold text-slate-900 text-[11px]">${b.humanId}</span>
                      <span class="font-semibold text-slate-900 text-xs truncate">${escapeHtml(b.title)}</span>
                    </div>
                    <div class="text-[11px] text-slate-500">${escapeHtml(b.projectName)} • ${b.workflowStage}</div>
                  </div>
                  <div class="text-right">
                    ${b.isBlocked ? `<span class="badge-blocked">Blocked</span>` : `<span class="badge-waiting">${b.daysInactive}d inactive</span>`}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-rose-600 text-xs">Failed to load reports: ${err.message}</div>`;
  }
}
