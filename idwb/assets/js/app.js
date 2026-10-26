// ID Workbench v2 - Restored Main Application Core & Dashboard
let currentRoute = 'dashboard';
let appUser = null;
let appProjects = [];
let appCategories = [];
window.allTasksCache = window.allTasksCache || [];
let hasDemoDataState = false;

// Listen for bfcache restoration and force full server revalidation
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  // Check session
  try {
    const auth = (window.__INITIAL_AUTH_USER__)
      ? { authenticated: true, user: window.__INITIAL_AUTH_USER__ }
      : await API.get('api/auth.php?action=me');
    if (!auth || !auth.authenticated) {
      window.location.replace('login.html');
      return;
    }
    appUser = auth.user;
    updateUserProfileUI();
  } catch (e) {
    window.location.replace('login.html');
    return;
  }

  // Bind core UI controls
  initNavigation();
  initQuickAddModal();
  initDemoDataToggle();
  initTour();

  // Load initial route from URL hash or default to dashboard
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigate(hash);
});

function updateUserProfileUI() {
  const nameEl = document.getElementById('user-name-display');
  const dropdownNameEl = document.getElementById('user-dropdown-name');
  const emailEl = document.getElementById('user-email-display');
  const roleEl = document.getElementById('user-role-badge');
  const avatarEl = document.getElementById('user-avatar-initials');

  if (nameEl) nameEl.innerText = appUser.name;
  if (dropdownNameEl) dropdownNameEl.innerText = appUser.name;
  if (emailEl) emailEl.innerText = appUser.email;
  if (roleEl) {
    const roleLabels = {
      'SUPER_ADMIN': 'Super Admin',
      'ADMIN': 'Admin',
      'INSTRUCTIONAL_DESIGNER': 'Designer'
    };
    roleEl.innerText = roleLabels[appUser.role] || appUser.role;
  }
  if (avatarEl) {
    const parts = appUser.name.split(' ');
    const initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    avatarEl.innerText = initials;
  }
}

function initNavigation() {
  window.addEventListener('hashchange', () => {
    const route = window.location.hash.replace('#', '') || 'dashboard';
    navigate(route);
  });

  // Mobile sidebar toggle
  const mobileBtn = document.getElementById('btn-mobile-sidebar');
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (mobileBtn && sidebar && backdrop) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
      backdrop.classList.toggle('hidden');
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
    });
  }

  // User menu dropdown toggle
  const userBtn = document.getElementById('user-menu-btn');
  const userMenu = document.getElementById('user-dropdown-menu');
  if (userBtn && userMenu) {
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu.classList.toggle('hidden');
      userBtn.setAttribute('aria-expanded', !userMenu.classList.contains('hidden'));
    });
    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target) && !userBtn.contains(e.target)) {
        userMenu.classList.add('hidden');
        userBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Logout action
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await API.post('api/auth.php?action=logout');
      Toast.info('Signed out successfully');
      setTimeout(() => { window.location.replace('login.html'); }, 300);
    });
  }

  // Global search input & Cmd+K handler
  const searchInput = document.getElementById('global-search-input');
  const searchForm = document.getElementById('global-search-form');
  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      if (q) {
        window.location.hash = `tasks?search=${encodeURIComponent(q)}`;
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });
}

function initTour() {
  const tourBtn = document.getElementById('tour-guide-btn');
  const menuTourBtn = document.getElementById('menu-tour-trigger');
  if (tourBtn) tourBtn.addEventListener('click', startProductTour);
  if (menuTourBtn) menuTourBtn.addEventListener('click', () => {
    const userMenu = document.getElementById('user-dropdown-menu');
    if (userMenu) userMenu.classList.add('hidden');
    startProductTour();
  });
}

function startProductTour() {
  if (!window.driver || !window.driver.js) {
    Toast.info('Product tour guide is ready');
    return;
  }

  const driverObj = window.driver.js.driver({
    showProgress: true,
    popoverClass: 'driver-popover idw-tour-popover',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Finish Tour',
    steps: [
      {
        element: '#tour-brand',
        popover: {
          title: 'ID Workbench Studio OS',
          description: 'Your unified command center for instructional design architecture, SAM/ADDIE progression, and zero-defect LMS delivery.'
        }
      },
      {
        element: '#global-search-form',
        popover: {
          title: 'Global Studio Search (⌘K)',
          description: 'Instantly find tasks, courses, SME records, or deliverable IDs anywhere in the studio.'
        }
      },
      {
        element: '#tour-demo-data',
        popover: {
          title: 'Demo Data Management',
          description: 'Switch between an empty studio and a rich realistic dataset with cybersecurity and biomedical courses in 1 click.'
        }
      },
      {
        element: '#tour-quick-add',
        popover: {
          title: 'Rapid Work Item Creator',
          description: 'Quickly create new modules, interactions, or SCORM packages with pre-configured 12-point quality gates.'
        }
      },
      {
        element: '#tour-nav-pipeline',
        popover: {
          title: '15-Stage Pedagogical Pipeline',
          description: 'Trace deliverables across all 15 instructional design stages, with automated blocker detection and SME handoffs.'
        }
      },
      {
        element: '#tour-nav-sme-inbox',
        popover: {
          title: 'SME Inbox & Zoom Scheduler',
          description: 'Manage incoming raw PowerPoint/Word documents and book Zoom meetings directly from the intake queue.'
        }
      },
      {
        element: '#tour-user-menu',
        popover: {
          title: 'User Profile & Settings',
          description: 'Access role permissions, change passwords, and configure Zoom Server-to-Server API credentials.'
        }
      }
    ]
  });

  driverObj.drive();
}

function initDemoDataToggle() {
  const btn = document.getElementById('tour-demo-data');
  if (!btn) return;

  // Initial check
  API.get('api/settings.php').then(data => {
    updateDemoDataButtonUI(Boolean(data && data.hasDemoData));
  }).catch(() => {});

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      if (hasDemoDataState) {
        await API.post('api/settings.php?action=purge_demo_data');
        updateDemoDataButtonUI(false);
        Toast.success('Demo data purged cleanly');
      } else {
        await API.post('api/settings.php?action=load_demo_data');
        updateDemoDataButtonUI(true);
        Toast.success('Demo dataset loaded successfully');
      }
      // Re-navigate current route to refresh view
      navigate(currentRoute);
    } catch (err) {
      Toast.error(err.message || 'Failed to toggle demo data');
    } finally {
      btn.disabled = false;
    }
  });
}

function updateDemoDataButtonUI(hasDemo) {
  hasDemoDataState = hasDemo;
  const btn = document.getElementById('tour-demo-data');
  const icon = document.getElementById('demo-btn-icon');
  const text = document.getElementById('demo-btn-text');
  if (!btn || !icon || !text) return;

  if (hasDemo) {
    btn.className = 'hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 active:translate-y-[0.5px] bg-amber-50/80 border-amber-300 text-amber-900 hover:bg-amber-100/90 shadow-xs';
    icon.setAttribute('data-lucide', 'trash-2');
    icon.className = 'w-3.5 h-3.5 text-amber-600';
    text.innerText = 'Purge Demo Data';
  } else {
    btn.className = 'hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 active:translate-y-[0.5px] bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300';
    icon.setAttribute('data-lucide', 'sparkles');
    icon.className = 'w-3.5 h-3.5 text-indigo-600';
    text.innerText = 'Load Demo';
  }
  if (window.lucide) lucide.createIcons();
}

function navigate(rawRoute) {
  let [route, queryStr] = rawRoute.split('?');
  route = route || 'dashboard';
  currentRoute = route;

  // Update active sidebar nav styling
  document.querySelectorAll('.nav-link').forEach(link => {
    const target = link.getAttribute('data-route');
    const icon = link.querySelector('i');
    if (target === route) {
      link.className = 'nav-link flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold bg-indigo-50/90 text-indigo-900 border border-indigo-200/80 shadow-2xs transition-all';
      if (icon) icon.className = 'w-4 h-4 text-indigo-700';
    } else {
      link.className = 'nav-link flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-950 hover:bg-slate-100/70 transition-all';
      if (icon) icon.className = 'w-4 h-4 text-slate-400 group-hover:text-slate-600';
    }
  });

  // Close mobile sidebar on navigate
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && backdrop && window.innerWidth < 1024) {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  }

  // Render view
  renderView(route, queryStr);
}

async function renderView(route, queryStr) {
  const container = document.getElementById('view-container');
  container.innerHTML = `
    <div class="flex items-center justify-center py-24">
      <div class="flex items-center gap-3 text-slate-400 text-sm">
        <span class="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></span>
        <span>Loading studio...</span>
      </div>
    </div>
  `;

  try {
    switch (route) {
      case 'dashboard':
        await renderDashboardView(container);
        break;
      case 'tasks':
        await renderTasksView(container, queryStr);
        break;
      case 'pipeline':
        await renderPipelineView(container, queryStr);
        break;
      case 'sme-inbox':
        await renderSmeInboxView(container);
        break;
      case 'reviews':
        await renderReviewsView(container);
        break;
      case 'projects':
        await renderProjectsView(container, queryStr);
        break;
      case 'calendar':
        await renderCalendarView(container);
        break;
      case 'reports':
        await renderReportsView(container);
        break;
      case 'settings':
        await renderSettingsView(container);
        break;
      default:
        await renderDashboardView(container);
    }
  } catch (err) {
    container.innerHTML = `
      <div class="p-8 text-center white-card my-6">
        <div class="text-rose-600 font-bold mb-2">Error loading view</div>
        <div class="text-xs text-slate-500 mb-4">${err.message}</div>
        <button onclick="navigate('dashboard')" class="btn-primary text-xs">Return to Overview</button>
      </div>
    `;
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// -------------------------------------------------------------------------------------------------
// 1. DASHBOARD VIEW (Studio Overview)
// -------------------------------------------------------------------------------------------------
async function renderDashboardView(container) {
  const data = await API.get('api/dashboard.php');
  appProjects = data.projects || [];
  appCategories = data.categories || [];

  // Update demo data toggle button
  updateDemoDataButtonUI(data.hasDemoData);

  // Update badge counts in sidebar
  const inboxBadge = document.getElementById('sidebar-inbox-badge');
  if (inboxBadge) {
    if (data.inboxCount > 0) {
      inboxBadge.innerText = data.inboxCount;
      inboxBadge.classList.remove('hidden');
    } else {
      inboxBadge.classList.add('hidden');
    }
  }

  // Sidebar Needs Attention alert box
  const attentionBox = document.getElementById('sidebar-attention-box');
  const attentionCountEl = document.getElementById('sidebar-attention-count');
  if (attentionBox && attentionCountEl) {
    if (data.attentionCount > 0) {
      attentionCountEl.innerText = data.attentionCount;
      attentionBox.classList.remove('hidden');
    } else {
      attentionBox.classList.add('hidden');
    }
  }

  const { kpis, todayFocusTasks, needsAttentionTasks, upcomingDeadlineTasks, recentIntakes, recentActivity, stageCounts } = data;

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">Studio Overview</h1>
            <span class="px-2 py-0.5 text-[10px] font-mono uppercase bg-slate-100 text-slate-700 border border-slate-200 rounded font-semibold">
              Daily Operations
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-0.5">
            Welcome back, ${data.user.name}. Operational state of all courses, SME reviews, and deliverables.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openQuickAddModal()" class="btn-primary text-xs">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>Create Full Deliverable</span>
          </button>
        </div>
      </div>

      <!-- 6 Top-Level Metric Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        
        <div onclick="window.location.hash='projects'" class="white-card-interactive p-4 sm:p-4.5 block group">
          <div class="flex items-center justify-between text-slate-500 group-hover:text-indigo-600 mb-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Active Projects</span>
            <div class="w-7 h-7 rounded-lg bg-slate-50 group-hover:bg-indigo-50 border border-slate-200/60 group-hover:border-indigo-200 flex items-center justify-center transition-colors">
              <i data-lucide="folder-git-2" class="w-3.5 h-3.5"></i>
            </div>
          </div>
          <div class="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">${kpis.activeProjects}</div>
          <p class="text-[11px] text-slate-500 mt-1">Courses in production</p>
        </div>

        <div onclick="window.location.hash='tasks?filter=today'" class="white-card-interactive p-4 sm:p-4.5 block group">
          <div class="flex items-center justify-between text-slate-500 group-hover:text-indigo-600 mb-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Due Today</span>
            <div class="w-7 h-7 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center justify-center transition-colors">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-indigo-700"></i>
            </div>
          </div>
          <div class="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">${kpis.tasksDueToday}</div>
          <p class="text-[11px] text-slate-500 mt-1">Daily commitments</p>
        </div>

        <div onclick="window.location.hash='tasks?health=overdue'" class="white-card-interactive p-4 sm:p-4.5 block group">
          <div class="flex items-center justify-between text-rose-700 mb-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Overdue</span>
            <div class="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200/80 flex items-center justify-center">
              <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-rose-600"></i>
            </div>
          </div>
          <div class="text-2xl sm:text-3xl font-extrabold text-rose-700 tracking-tight">${kpis.overdueTasks}</div>
          <p class="text-[11px] text-rose-600 mt-1 font-medium">Past target date</p>
        </div>

        <div onclick="window.location.hash='tasks?health=waiting'" class="white-card-interactive p-4 sm:p-4.5 block group">
          <div class="flex items-center justify-between text-amber-800 mb-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Waiting on SME</span>
            <div class="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center">
              <i data-lucide="user-check" class="w-3.5 h-3.5 text-amber-700"></i>
            </div>
          </div>
          <div class="text-2xl sm:text-3xl font-extrabold text-amber-800 tracking-tight">${kpis.waitingOnSME}</div>
          <p class="text-[11px] text-amber-800 mt-1 font-medium">Pending feedback</p>
        </div>

        <div onclick="window.location.hash='tasks?health=blocked'" class="white-card-interactive p-4 sm:p-4.5 block group">
          <div class="flex items-center justify-between text-rose-700 mb-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Blocked</span>
            <div class="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200/80 flex items-center justify-center">
              <i data-lucide="ban" class="w-3.5 h-3.5 text-rose-600"></i>
            </div>
          </div>
          <div class="text-2xl sm:text-3xl font-extrabold text-rose-700 tracking-tight">${kpis.blockedTasks}</div>
          <p class="text-[11px] text-rose-600 mt-1 font-medium">With recorded reason</p>
        </div>

        <div onclick="window.location.hash='tasks?stage=Delivered'" class="white-card-interactive p-4 sm:p-4.5 block group">
          <div class="flex items-center justify-between text-emerald-800 mb-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Done (7d)</span>
            <div class="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center">
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-700"></i>
            </div>
          </div>
          <div class="text-2xl sm:text-3xl font-extrabold text-emerald-800 tracking-tight">${kpis.completedThisWeek}</div>
          <p class="text-[11px] text-emerald-700 mt-1 font-medium">Completed this week</p>
        </div>

      </div>

      <!-- Section 1 & 2: Today's Focus & Work Pipeline Summary -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Today's Focus: 7 columns -->
        <div class="lg:col-span-7 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i data-lucide="flame" class="w-4 h-4 text-amber-600"></i>
              <h2 class="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                Today's Focus &amp; Priority Work
              </h2>
            </div>
            <a href="#tasks" class="text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 transition-colors">
              View all tasks <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </a>
          </div>

          ${todayFocusTasks.length === 0 ? `
            <div class="white-panel p-8 text-center space-y-2 border-dashed">
              <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-600 mx-auto"></i>
              <p class="text-sm font-semibold text-slate-900">No overdue or urgent items today</p>
              <p class="text-xs text-slate-500 max-w-sm mx-auto">
                All target deliverables are on track. You can pick the next item from your pipeline or incoming SME queue.
              </p>
            </div>
          ` : `
            <div class="space-y-2.5">
              ${todayFocusTasks.map(task => `
                <div onclick="openTaskDetail('${task.id}')" class="white-card-interactive p-4 flex items-start justify-between gap-3.5 block group">
                  <div class="space-y-1.5 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-mono text-xs font-bold text-indigo-700">${task.humanId}</span>
                      <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">${task.projectCode}</span>
                      <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        task.priority === 'Urgent' ? 'bg-rose-50 text-rose-800 border border-rose-200/80' :
                        task.priority === 'High' ? 'bg-amber-50 text-amber-900 border border-amber-200/80' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }">
                        ${task.priority}
                      </span>
                      ${task.isBlocked ? `
                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80">
                          Blocked
                        </span>
                      ` : ''}
                    </div>
                    <h3 class="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                      ${task.title}
                    </h3>
                    ${task.nextAction ? `
                      <p class="text-xs text-slate-500 truncate">
                        <span class="font-medium text-slate-700">Next:</span> ${task.nextAction}
                      </p>
                    ` : ''}
                  </div>
                  <div class="text-right shrink-0">
                    <div class="text-xs font-semibold text-slate-900">${formatDateShort(task.dueDate)}</div>
                    <span class="text-[11px] text-slate-500 block mt-0.5 font-medium">${task.workflowStage}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Work Pipeline Stage Distribution: 5 columns -->
        <div class="lg:col-span-5 space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
              Work Pipeline by Stage
            </h2>
            <a href="#pipeline" class="text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 transition-colors">
              Kanban view <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </a>
          </div>

          <div class="white-panel p-3.5 space-y-1 divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
            ${Object.entries(stageCounts).map(([stageName, count]) => `
              <div onclick="window.location.hash='pipeline?stage=${encodeURIComponent(stageName)}'" class="flex items-center justify-between py-2 text-xs hover:bg-slate-50 px-2 rounded-lg transition-colors group cursor-pointer">
                <span class="text-slate-700 font-medium group-hover:text-slate-900 truncate pr-2">${stageName}</span>
                <span class="font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                  count > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70' : 'bg-slate-100 text-slate-400'
                }">
                  ${count}
                </span>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

      <!-- Section 3 & 4: Needs Attention & Recently Received SME Inbox -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Needs Attention: 7 columns -->
        <div class="lg:col-span-7 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600"></i>
              <h2 class="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900">
                Needs Attention (${needsAttentionTasks.length})
              </h2>
            </div>
            <a href="#tasks?health=attention" class="text-xs font-semibold text-rose-700 hover:text-rose-900 transition-colors">
              Filter all (${needsAttentionTasks.length})
            </a>
          </div>

          ${needsAttentionTasks.length === 0 ? `
            <div class="white-panel p-8 text-center space-y-2 border-dashed">
              <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-600 mx-auto"></i>
              <p class="text-sm font-semibold text-slate-900">Zero active blockers or overdue work</p>
              <p class="text-xs text-slate-500">All active deliverables are proceeding on schedule.</p>
            </div>
          ` : `
            <div class="space-y-2.5">
              ${needsAttentionTasks.map(task => {
                const health = task.health || { healthBadge: 'At Risk', reasons: [] };
                return `
                <div onclick="openTaskDetail('${task.id}')" class="white-card-interactive p-3.5 border-l-[3px] border-l-rose-500 block group">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-2 mb-1.5">
                        <span class="font-mono text-xs font-bold text-slate-900">${task.humanId || ''}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80 font-semibold">${health.healthBadge || 'Attention'}</span>
                        <span class="text-xs text-slate-500">${task.projectCode || ''}</span>
                      </div>
                      <h4 class="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                        ${task.title}
                      </h4>
                      <div class="mt-1.5 text-[11px] text-rose-700 space-y-0.5">
                        ${(health.reasons || []).map(r => `<p>• ${r}</p>`).join('')}
                      </div>
                    </div>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0 self-center"></i>
                  </div>
                </div>
              `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Recently Received SME Inbox: 5 columns -->
        <div class="lg:col-span-5 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i data-lucide="inbox" class="w-4 h-4 text-slate-700"></i>
              <h2 class="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                Recently Received SME Material
              </h2>
            </div>
            <a href="#sme-inbox" class="text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 transition-colors">
              SME Inbox <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </a>
          </div>

          ${recentIntakes.length === 0 ? `
            <div class="white-panel p-8 text-center space-y-2 border-dashed">
              <i data-lucide="inbox" class="w-8 h-8 text-slate-400 mx-auto"></i>
              <p class="text-sm font-semibold text-slate-800">SME Inbox is clear</p>
              <p class="text-xs text-slate-500 max-w-xs mx-auto">
                Record new incoming PowerPoint, Word, or video materials from SMEs.
              </p>
            </div>
          ` : `
            <div class="space-y-2.5">
              ${recentIntakes.map(intake => `
                <div onclick="window.location.hash='sme-inbox'" class="white-card-interactive p-3.5 block group">
                  <div class="flex items-start justify-between gap-2.5">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-[11px] font-bold text-indigo-700">${intake.humanId}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          ${intake.materialType} v${intake.version}
                        </span>
                      </div>
                      <p class="text-xs font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors truncate mt-1">
                        ${intake.title}
                      </p>
                      <p class="text-[11px] text-slate-500 mt-0.5">
                        From: ${intake.senderName} • ${formatDateShort(intake.receivedDate)}
                      </p>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                      intake.isConverted ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/70' :
                      intake.completeness === 'Complete' ? 'bg-blue-50 text-blue-800 border border-blue-200/70' :
                      'bg-amber-50 text-amber-900 border border-amber-200/70'
                    }">
                      ${intake.isConverted ? 'Converted' : intake.completeness}
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

      </div>

      <!-- Section 5 & 6: Upcoming Deadlines & Recent Activity Feed -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Upcoming Deadlines: 6 columns -->
        <div class="lg:col-span-6 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i data-lucide="calendar" class="w-4 h-4 text-slate-700"></i>
              <h2 class="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                Upcoming Deadlines (Next 14 Days)
              </h2>
            </div>
            <a href="#calendar" class="text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition-colors">
              Calendar view →
            </a>
          </div>

          ${upcomingDeadlineTasks.length === 0 ? `
            <div class="white-panel p-8 text-center text-xs text-slate-500 border-dashed">
              No deliverables due in the next 14 days.
            </div>
          ` : `
            <div class="space-y-2.5">
              ${upcomingDeadlineTasks.map(t => {
                const daysLeft = Math.ceil((new Date(t.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
                return `
                  <div onclick="openTaskDetail('${t.id}')" class="white-card-interactive p-3.5 flex items-center justify-between block group">
                    <div class="min-w-0 pr-3">
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-xs font-bold text-indigo-700">${t.humanId}</span>
                        <span class="text-[10px] text-slate-500">${t.projectCode}</span>
                      </div>
                      <p class="text-xs font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors truncate mt-0.5">
                        ${t.title}
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <span class="text-xs font-bold text-slate-900 block">${formatDateShort(t.dueDate)}</span>
                      <span class="text-[10px] text-slate-500">${daysLeft >= 0 ? `${daysLeft} days left` : 'Overdue'}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Recent Activity: 6 columns -->
        <div class="lg:col-span-6 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i data-lucide="activity" class="w-4 h-4 text-slate-700"></i>
              <h2 class="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                Audit &amp; Activity Log
              </h2>
            </div>
          </div>

          ${recentActivity.length === 0 ? `
            <div class="white-panel p-8 text-center text-xs text-slate-500 border-dashed">
              No recent activity recorded yet. Create or update tasks to generate an audit trail.
            </div>
          ` : `
            <div class="white-panel p-4 space-y-3 max-h-[340px] overflow-y-auto divide-y divide-slate-100">
              ${recentActivity.map(act => `
                <div class="pt-2.5 first:pt-0 text-xs">
                  <div class="flex items-center justify-between mb-0.5">
                    <span class="font-semibold text-slate-900">${act.title}</span>
                    <span class="text-[10px] text-slate-400 font-mono">${formatDateTime(act.createdAt)}</span>
                  </div>
                  ${act.description ? `<p class="text-[11px] text-slate-600">${act.description}</p>` : ''}
                  <div class="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                    ${act.workItemId ? `<span>IDW Task</span>` : ''}
                    <span>• ${act.userEmail}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

      </div>

    </div>
  `;
}

// -------------------------------------------------------------------------------------------------
// Quick Add Modal Logic
// -------------------------------------------------------------------------------------------------
function initQuickAddModal() {
  const form = document.getElementById('quick-add-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('qa-title').value.trim();
      const projectId = document.getElementById('qa-project').value;
      const workType = document.getElementById('qa-worktype').value;
      const priority = document.getElementById('qa-priority').value;
      const dueDate = document.getElementById('qa-duedate').value;
      const smeName = document.getElementById('qa-smename').value.trim();
      const estimatedHours = parseFloat(document.getElementById('qa-esthours').value) || 16;

      try {
        const res = await API.post('api/tasks.php', {
          title, projectId, workType, priority, dueDate, smeName, estimatedHours
        });
        if (res && res.humanId) {
          Toast.success(`Created deliverable ${res.humanId}`);
          closeQuickAddModal();
          navigate(currentRoute);
        }
      } catch (err) {
        Toast.error(err.message || 'Failed to create deliverable');
      }
    });
  }
}

function openQuickAddModal() {
  const modal = document.getElementById('quick-add-modal');
  const projSelect = document.getElementById('qa-project');
  if (projSelect) {
    projSelect.innerHTML = appProjects.map(p => `<option value="${p.id}">[${p.code}] ${p.name}</option>`).join('');
  }
  if (modal) modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeQuickAddModal() {
  const modal = document.getElementById('quick-add-modal');
  if (modal) modal.classList.add('hidden');
}

// Utility date formatting
function formatDateShort(dateStr) {
  if (!dateStr) return 'No due date';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function renderHealthBadge(health) {
  if (!health) {
    return `<span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">On Track</span>`;
  }
  const badge = health.healthBadge || (health.isBlocked ? 'Blocked' : health.isOverdue ? 'Overdue' : health.isWaitingOnSME ? 'Waiting on SME' : health.isAtRisk ? 'At Risk' : 'On Track');
  const cls = badge === 'Blocked' || badge === 'Overdue'
    ? 'bg-rose-50 text-rose-800 border-rose-200/80'
    : badge === 'Waiting on SME' || badge === 'At Risk'
    ? 'bg-amber-50 text-amber-900 border-amber-200/80'
    : 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
  return `<span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}">${badge}</span>`;
}
window.renderHealthBadge = renderHealthBadge;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;
