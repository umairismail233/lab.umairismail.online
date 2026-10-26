// ID Workbench v2 - Calendar View
// Restored element-for-element and interaction-for-interaction from original CalendarClient.tsx

let calendarCurrentMonth = new Date();
let calendarViewMode = 'month';
let calendarSelectedProject = '';
let cachedCalendarEvents = [];
let cachedCalendarProjects = [];

async function renderCalendarView(container) {
  try {
    const [events, projects] = await Promise.all([
      API.get('api/calendar.php'),
      API.get('api/projects.php')
    ]);

    cachedCalendarEvents = events || [];
    cachedCalendarProjects = projects || [];

    renderCalendarContent(container);
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-rose-600 text-xs">Failed to load calendar: ${err.message}</div>`;
  }
}

function renderCalendarContent(container) {
  const filteredEvents = cachedCalendarEvents.filter(e => {
    if (!calendarSelectedProject) return true;
    return e.project === calendarSelectedProject;
  });

  const year = calendarCurrentMonth.getFullYear();
  const month = calendarCurrentMonth.getMonth();
  const monthName = calendarCurrentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <i data-lucide="calendar-days" class="w-5 h-5 text-indigo-600"></i>
            <span>Instructional Calendar & Deadlines</span>
          </h1>
          <p class="text-xs text-slate-500 mt-1">
            Track planned start dates, storyboard due dates, SME review turnarounds, and LMS deployments.
          </p>
        </div>

        <!-- Controls: Course filter, month navigation, view mode -->
        <div class="flex items-center gap-2 flex-wrap text-xs">
          <select id="calendar-course-select" onchange="handleCalendarProjectChange(this.value)" class="clean-input text-xs py-1.5">
            <option value="">All Courses</option>
            ${cachedCalendarProjects.map(p => `
              <option value="${p.code}" ${calendarSelectedProject === p.code ? 'selected' : ''}>
                [${p.code}] ${p.name}
              </option>
            `).join('')}
          </select>

          <div class="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onclick="setCalendarViewMode('month')"
              class="px-3 py-1 rounded transition-colors ${calendarViewMode === 'month' ? 'bg-white text-indigo-600 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}"
            >
              Month
            </button>
            <button
              onclick="setCalendarViewMode('agenda')"
              class="px-3 py-1 rounded transition-colors ${calendarViewMode === 'agenda' ? 'bg-white text-indigo-600 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}"
            >
              Agenda
            </button>
          </div>

          <div class="flex items-center gap-1">
            <button onclick="prevCalendarMonth()" class="btn-secondary py-1 px-2 text-xs" title="Previous Month">
              <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
            <span class="font-bold text-slate-800 px-2 min-w-[120px] text-center">${monthName}</span>
            <button onclick="nextCalendarMonth()" class="btn-secondary py-1 px-2 text-xs" title="Next Month">
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Body -->
      ${calendarViewMode === 'month' ? renderMonthGrid(year, month, filteredEvents) : renderAgendaView(filteredEvents)}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function renderMonthGrid(year, month, events) {
  const eventsByDate = {};
  events.forEach(e => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const now = new Date();
  const isCurrentMonth = (now.getFullYear() === year && now.getMonth() === month);

  let gridCells = '';
  for (let i = 0; i < firstDay; i++) {
    gridCells += `<div class="bg-slate-50/50 p-2 min-h-[95px] border border-slate-100"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    const dayEvents = eventsByDate[dateStr] || [];
    const isToday = isCurrentMonth && (d === now.getDate());

    gridCells += `
      <div class="p-2 min-h-[95px] border border-slate-200/80 bg-white flex flex-col justify-between ${isToday ? 'ring-2 ring-indigo-600/40' : ''}">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold ${isToday ? 'w-5 h-5 rounded-full bg-indigo-700 text-white flex items-center justify-center text-[10px]' : 'text-slate-700'}">${d}</span>
          ${dayEvents.length > 0 ? `<span class="text-[9px] font-mono text-slate-400">${dayEvents.length} due</span>` : ''}
        </div>
        <div class="space-y-1 overflow-y-auto max-h-[65px]">
          ${dayEvents.map(ev => `
            <div
              onclick="${ev.type === 'task' ? `openTaskDetail('${ev.id}')` : ''}"
              class="px-1.5 py-0.5 rounded text-[10px] truncate font-medium cursor-pointer transition-colors ${ev.type === 'milestone' ? 'bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200' : 'bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100'}"
              title="${escapeHtml(ev.title)}"
            >
              ${escapeHtml(ev.title)}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div class="white-card overflow-hidden">
      <div class="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center font-bold text-[11px] text-slate-600 uppercase tracking-wider py-2">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div class="grid grid-cols-7 divide-x divide-y divide-slate-100">
        ${gridCells}
      </div>
    </div>
  `;
}

function renderAgendaView(events) {
  if (events.length === 0) {
    return `
      <div class="white-card p-12 text-center text-xs text-slate-400">
        No scheduled deliverables or milestones found for this filter.
      </div>
    `;
  }

  // Sort events by date
  const sorted = [...events].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return `
    <div class="white-card p-5 space-y-4">
      <div class="divide-y divide-slate-100">
        ${sorted.map(ev => `
          <div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="font-mono text-[10px] font-bold px-2 py-0.5 rounded ${ev.type === 'milestone' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}">
                  ${ev.type === 'milestone' ? 'MILESTONE' : 'DUE DATE'}
                </span>
                <span class="font-mono text-slate-500 font-semibold">${ev.date}</span>
                <span class="text-slate-400">• [${ev.project}]</span>
              </div>
              <h4 class="font-bold text-slate-900 ${ev.type === 'task' ? 'cursor-pointer hover:text-indigo-600' : ''}" onclick="${ev.type === 'task' ? `openTaskDetail('${ev.id}')` : ''}">
                ${escapeHtml(ev.title)}
              </h4>
            </div>
            ${ev.type === 'task' ? `
              <button onclick="openTaskDetail('${ev.id}')" class="btn-secondary text-[11px] py-1 px-2.5 self-start sm:self-center">
                Inspect Deliverable →
              </button>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function setCalendarViewMode(mode) {
  calendarViewMode = mode;
  renderCalendarContent(document.getElementById('view-container'));
}

function handleCalendarProjectChange(projectCode) {
  calendarSelectedProject = projectCode;
  renderCalendarContent(document.getElementById('view-container'));
}

function prevCalendarMonth() {
  calendarCurrentMonth = new Date(calendarCurrentMonth.getFullYear(), calendarCurrentMonth.getMonth() - 1, 1);
  renderCalendarContent(document.getElementById('view-container'));
}

function nextCalendarMonth() {
  calendarCurrentMonth = new Date(calendarCurrentMonth.getFullYear(), calendarCurrentMonth.getMonth() + 1, 1);
  renderCalendarContent(document.getElementById('view-container'));
}
