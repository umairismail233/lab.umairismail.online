// ID Workbench v2 - Settings & System Preferences View
// Restored element-for-element and interaction-for-interaction from original SettingsClient.tsx

let activeSettingsTab = 'account';
let cachedSettingsData = null;

async function renderSettingsView(container, queryStr = '') {
  const params = new URLSearchParams(queryStr);
  const tabParam = params.get('tab');
  if (tabParam && ['account', 'users', 'categories', 'data', 'integrations'].includes(tabParam)) {
    activeSettingsTab = tabParam;
  }

  try {
    cachedSettingsData = await API.get('api/settings.php');
    renderSettingsContent(container);
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-rose-600 text-xs">Failed to load settings: ${err.message}</div>`;
  }
}

function renderSettingsContent(container) {
  const { integrations, users, hasDemoData } = cachedSettingsData;
  const currentUser = window.currentUser || { name: 'Abeera', email: 'Abeera@wb.com', role: 'SUPER_ADMIN' };

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <i data-lucide="settings" class="w-5 h-5 text-indigo-600"></i>
            <span>Settings & System Preferences</span>
          </h1>
          <p class="text-xs text-slate-500 mt-1">
            Configure personal account security, team permissions, taxonomy categories, system demo data, and external webhooks.
          </p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-1 border-b border-slate-200 text-xs overflow-x-auto pb-px">
        <button
          onclick="switchSettingsTab('account')"
          class="px-4 py-2.5 font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeSettingsTab === 'account' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'}"
        >
          <i data-lucide="user" class="w-4 h-4"></i>
          <span>Account Settings</span>
        </button>
        <button
          onclick="switchSettingsTab('users')"
          class="px-4 py-2.5 font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeSettingsTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'}"
        >
          <i data-lucide="users" class="w-4 h-4"></i>
          <span>Team Members (${users.length})</span>
        </button>
        <button
          onclick="switchSettingsTab('categories')"
          class="px-4 py-2.5 font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeSettingsTab === 'categories' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'}"
        >
          <i data-lucide="tag" class="w-4 h-4"></i>
          <span>Deliverable Categories</span>
        </button>
        <button
          onclick="switchSettingsTab('data')"
          class="px-4 py-2.5 font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeSettingsTab === 'data' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'}"
        >
          <i data-lucide="database" class="w-4 h-4"></i>
          <span>Demo Data & Storage</span>
        </button>
        <button
          onclick="switchSettingsTab('integrations')"
          class="px-4 py-2.5 font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeSettingsTab === 'integrations' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'}"
        >
          <i data-lucide="radio" class="w-4 h-4"></i>
          <span>Integrations & Webhooks</span>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="settings-tab-panel">
        ${renderActiveTab(currentUser, users, integrations, hasDemoData)}
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function switchSettingsTab(tabName) {
  activeSettingsTab = tabName;
  renderSettingsContent(document.getElementById('view-container'));
}

function renderActiveTab(currentUser, users, integrations, hasDemoData) {
  switch (activeSettingsTab) {
    case 'account':
      return renderAccountTab(currentUser);
    case 'users':
      return renderUsersTab(users);
    case 'categories':
      return renderCategoriesTab();
    case 'data':
      return renderDataTab(hasDemoData);
    case 'integrations':
      return renderIntegrationsTab(integrations);
    default:
      return renderAccountTab(currentUser);
  }
}

// -------------------------------------------------------------
// 1. Account Tab
// -------------------------------------------------------------
function renderAccountTab(currentUser) {
  return `
    <div class="space-y-6 max-w-2xl">
      <!-- Profile Card -->
      <div class="white-card p-5 space-y-4">
        <div class="border-b border-slate-100 pb-3">
          <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i data-lucide="user-check" class="w-4 h-4 text-indigo-600"></i>
            <span>Signed In Profile</span>
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">Your personal credentials and role assignments within Studio OS.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span class="text-slate-400 block text-[11px]">Full Name</span>
            <span class="font-bold text-slate-900 text-sm mt-0.5 block">${escapeHtml(currentUser.name || 'User')}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[11px]">Email Address</span>
            <span class="font-mono text-slate-800 text-xs mt-0.5 block">${escapeHtml(currentUser.email || 'user@workbench.internal')}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[11px]">Role Permission</span>
            <span class="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">
              ${escapeHtml(currentUser.role || 'ADMIN')}
            </span>
          </div>
          <div>
            <span class="text-slate-400 block text-[11px]">Session Status</span>
            <span class="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-xs mt-0.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Authenticated</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Change Password Card -->
      <div class="white-card p-5 space-y-4">
        <div class="border-b border-slate-100 pb-3">
          <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i data-lucide="lock" class="w-4 h-4 text-indigo-600"></i>
            <span>Change Account Password</span>
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">Update your local password. Minimum 8 characters required.</p>
        </div>

        <form id="change-password-form" onsubmit="handleChangePasswordSubmit(event)" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Current Password *</label>
            <input
              type="password"
              id="pwd-current"
              required
              class="clean-input w-full"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">New Password *</label>
              <input
                type="password"
                id="pwd-new"
                required
                minlength="8"
                class="clean-input w-full"
              />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Confirm New Password *</label>
              <input
                type="password"
                id="pwd-confirm"
                required
                minlength="8"
                class="clean-input w-full"
              />
            </div>
          </div>

          <div class="pt-2">
            <button type="submit" class="btn-primary text-xs py-2 px-3.5 inline-flex items-center gap-1.5">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Update Password</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function handleChangePasswordSubmit(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('pwd-current').value;
  const newPassword = document.getElementById('pwd-new').value;
  const confirmPassword = document.getElementById('pwd-confirm').value;

  if (newPassword !== confirmPassword) {
    Toast.error('New passwords do not match');
    return;
  }

  try {
    await API.post('api/settings.php?action=change_password', {
      currentPassword,
      newPassword
    });
    Toast.success('Password updated successfully');
    document.getElementById('change-password-form').reset();
  } catch (err) {
    Toast.error(err.message || 'Failed to update password');
  }
}

// -------------------------------------------------------------
// 2. Users Tab
// -------------------------------------------------------------
function renderUsersTab(users) {
  return `
    <div class="white-card p-5 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i data-lucide="users" class="w-4 h-4 text-indigo-600"></i>
            <span>Team Accounts & Access Control (${users.length})</span>
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">Instructional designers, lead architects, and administrators.</p>
        </div>
        <button onclick="openNewUserModal()" class="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 self-start sm:self-center">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>Add Team Member</span>
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-600">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-800 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th class="px-4 py-2.5">Name</th>
              <th class="px-4 py-2.5">Email</th>
              <th class="px-4 py-2.5">Role</th>
              <th class="px-4 py-2.5">Created</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${users.map(u => `
              <tr class="hover:bg-slate-50/70 transition-colors">
                <td class="px-4 py-3 font-bold text-slate-900">${escapeHtml(u.name)}</td>
                <td class="px-4 py-3 font-mono text-[11px] text-slate-600">${escapeHtml(u.email)}</td>
                <td class="px-4 py-3">
                  <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800' : u.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'}">
                    ${u.role}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-400 font-mono text-[11px]">${u.createdAt ? u.createdAt.substring(0, 10) : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// 3. Categories Tab
// -------------------------------------------------------------
function renderCategoriesTab() {
  const categories = [
    { name: 'Module', desc: 'Standard SCORM interactive course module or lesson package', color: 'indigo' },
    { name: 'Storyboard', desc: 'Pedagogical layout, instructional flow, and script blueprint', color: 'blue' },
    { name: 'Video Script', desc: 'Audiovisual narrative, presenter cue notes, and recording script', color: 'purple' },
    { name: 'Assessment', desc: 'Formative knowledge checks, quiz banks, and summative exams', color: 'emerald' },
    { name: 'Job Aid', desc: 'Quick reference guide, PDF performance support document, or SOP', color: 'amber' }
  ];

  return `
    <div class="white-card p-5 space-y-4 max-w-3xl">
      <div class="border-b border-slate-100 pb-3">
        <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
          <i data-lucide="tag" class="w-4 h-4 text-indigo-600"></i>
          <span>Deliverable Categories & Typology</span>
        </h2>
        <p class="text-xs text-slate-500 mt-0.5">Classification taxonomy applied to course deliverables and production workflows.</p>
      </div>

      <div class="divide-y divide-slate-100">
        ${categories.map(c => `
          <div class="py-3 flex items-start justify-between gap-3 text-xs">
            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="font-bold text-slate-900">${c.name}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">System Taxonomy</span>
              </div>
              <p class="text-slate-500 text-[11px]">${c.desc}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// 4. Data & Storage Tab
// -------------------------------------------------------------
function renderDataTab(hasDemoData) {
  return `
    <div class="space-y-6 max-w-2xl">
      <div class="white-card p-5 space-y-4">
        <div class="border-b border-slate-100 pb-3">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <i data-lucide="database" class="w-4 h-4 text-indigo-600"></i>
              <span>Demo Dataset Control</span>
            </h2>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold border ${hasDemoData ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200'}">
              ${hasDemoData ? '● Demo Data Active' : '○ Demo Data Not Present'}
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            Populate realistic corporate instructional design deliverables, projects, and QA items for staging tests.
          </p>
        </div>

        <div class="flex items-center gap-3 pt-1">
          ${hasDemoData ? `
            <button onclick="purgeDemoData()" class="btn-danger text-xs py-2 px-3.5 inline-flex items-center gap-1.5">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
              <span>Purge Demo Dataset</span>
            </button>
          ` : `
            <button onclick="loadDemoData()" class="btn-primary text-xs py-2 px-3.5 inline-flex items-center gap-1.5">
              <i data-lucide="sparkles" class="w-4 h-4"></i>
              <span>Load Rich Demo Dataset</span>
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// 5. Integrations Tab
// -------------------------------------------------------------
function renderIntegrationsTab(integrations) {
  return `
    <div class="space-y-6 max-w-3xl">
      <div class="white-card p-5 space-y-4">
        <div class="border-b border-slate-100 pb-3">
          <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i data-lucide="radio" class="w-4 h-4 text-indigo-600"></i>
            <span>Microsoft Teams & Collaboration Webhooks</span>
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">Send automated notifications to instructional design channels when stages advance or blockers occur.</p>
        </div>

        <form id="settings-integrations-form" onsubmit="handleSaveIntegrationsSubmit(event)" class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Microsoft Teams Incoming Webhook URL</label>
            <input
              type="url"
              id="teams-webhook"
              placeholder="https://outlook.office.com/webhook/..."
              value="${escapeHtml(integrations.teamsWebhookUrl || '')}"
              class="clean-input w-full"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="teams-enabled" ${integrations.teamsEnabled ? 'checked' : ''} class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
              <span class="font-medium text-slate-800">Enable Teams Notifications</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="notify-blocked" ${integrations.notifyBlocked ? 'checked' : ''} class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
              <span class="font-medium text-slate-800">Alert on Task Blockers</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="notify-sme" ${integrations.notifySmeReview ? 'checked' : ''} class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
              <span class="font-medium text-slate-800">Alert on SME Review Requests</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="notify-delivered" ${integrations.notifyDelivered ? 'checked' : ''} class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
              <span class="font-medium text-slate-800">Alert on SCORM Delivery</span>
            </label>
          </div>

          <!-- Zoom Settings Sub-section -->
          <div class="border-t border-slate-100 pt-4 mt-4 space-y-3">
            <h3 class="text-xs font-bold text-slate-900 flex items-center gap-2">
              <i data-lucide="video" class="w-4 h-4 text-blue-600"></i>
              <span>Zoom Meeting Walkthrough Defaults</span>
            </h3>
            <p class="text-[11px] text-slate-500">Pre-fill your Personal Meeting ID (PMI) or Server-to-Server OAuth credentials for 1-click SME walkthroughs.</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Default PMI or Static URL</label>
                <input
                  type="text"
                  id="zoom-pmi"
                  placeholder="https://zoom.us/j/1234567890 or 123-456-7890"
                  value="${escapeHtml(integrations.zoomDefaultPmi || '')}"
                  class="clean-input w-full"
                />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Meeting Passcode</label>
                <input
                  type="text"
                  id="zoom-passcode-default"
                  placeholder="e.g. idw123"
                  value="${escapeHtml(integrations.zoomPasscode || 'idw123')}"
                  class="clean-input w-full"
                />
              </div>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100">
            <button type="submit" class="btn-primary text-xs py-2 px-3.5 inline-flex items-center gap-1.5">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Save Integration Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function handleSaveIntegrationsSubmit(e) {
  e.preventDefault();
  try {
    await API.post('api/settings.php?action=save_integrations', {
      teamsWebhookUrl: document.getElementById('teams-webhook').value.trim(),
      teamsEnabled: document.getElementById('teams-enabled').checked,
      notifyBlocked: document.getElementById('notify-blocked').checked,
      notifySmeReview: document.getElementById('notify-sme').checked,
      notifyDelivered: document.getElementById('notify-delivered').checked,
      zoomDefaultPmi: document.getElementById('zoom-pmi').value.trim(),
      zoomPasscode: document.getElementById('zoom-passcode-default').value.trim(),
    });
    Toast.success('Integration preferences saved successfully');
    renderSettingsView(document.getElementById('view-container'));
  } catch (err) {
    Toast.error(err.message);
  }
}

// -------------------------------------------------------------
// New User Modal
// -------------------------------------------------------------
function openNewUserModal() {
  let modal = document.getElementById('new-user-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'new-user-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="white-card p-6 max-w-md w-full shadow-2xl space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
          <i data-lucide="user-plus" class="w-4 h-4 text-indigo-600"></i>
          <span>Add Team Member</span>
        </h3>
        <button onclick="closeNewUserModal()" class="text-slate-400 hover:text-slate-600">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <form id="new-user-form" onsubmit="handleCreateUserSubmit(event)" class="space-y-3.5 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Full Name *</label>
          <input
            type="text"
            id="user-new-name"
            required
            placeholder="e.g. Sarah Connor"
            class="clean-input w-full"
          />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Corporate Email Address *</label>
          <input
            type="email"
            id="user-new-email"
            required
            placeholder="e.g. sconnor@workbench.internal"
            class="clean-input w-full"
          />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Role Permission *</label>
          <select id="user-new-role" class="clean-input w-full">
            <option value="INSTRUCTIONAL_DESIGNER">Instructional Designer</option>
            <option value="ADMIN">Studio Administrator</option>
            <option value="SUPER_ADMIN">Lead Architect / Super Admin</option>
          </select>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Initial Password (min 8 chars) *</label>
          <input
            type="password"
            id="user-new-password"
            required
            minlength="8"
            class="clean-input w-full"
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <button type="button" onclick="closeNewUserModal()" class="btn-secondary text-xs">
            Cancel
          </button>
          <button type="submit" class="btn-primary text-xs">
            Create Account
          </button>
        </div>
      </form>
    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeNewUserModal() {
  const modal = document.getElementById('new-user-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleCreateUserSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('user-new-name').value.trim();
  const email = document.getElementById('user-new-email').value.trim();
  const role = document.getElementById('user-new-role').value;
  const password = document.getElementById('user-new-password').value;

  try {
    await API.post('api/settings.php?action=create_user', {
      name,
      email,
      role,
      password
    });
    Toast.success('Team member created successfully');
    closeNewUserModal();
    renderSettingsView(document.getElementById('view-container'));
  } catch (err) {
    Toast.error(err.message || 'Failed to create user');
  }
}

async function purgeDemoData() {
  if (!confirm('Are you sure you want to purge all demo data? This removes sample deliverables and intakes.')) return;
  try {
    await API.post('api/settings.php?action=purge_demo_data', {});
    Toast.success('Demo data purged cleanly');
    renderSettingsView(document.getElementById('view-container'));
    if (window.initDemoDataToggle) initDemoDataToggle();
  } catch (err) {
    Toast.error(err.message);
  }
}

async function loadDemoData() {
  try {
    await API.post('api/settings.php?action=load_demo_data', {});
    Toast.success('Rich corporate demo dataset loaded');
    renderSettingsView(document.getElementById('view-container'));
    if (window.initDemoDataToggle) initDemoDataToggle();
  } catch (err) {
    Toast.error(err.message);
  }
}
