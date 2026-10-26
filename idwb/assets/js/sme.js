// ID Workbench v2 - SME Inbox & Material Intake View
// Restored element-for-element and interaction-for-interaction from original SMEInboxClient.tsx

let cachedIntakes = [];
let cachedProjects = [];
let cachedSettings = null;

async function renderSmeInboxView(container) {
  try {
    const [intakes, projects, settings] = await Promise.all([
      API.get('api/sme.php'),
      API.get('api/projects.php'),
      API.get('api/settings.php').catch(() => ({ integrations: {} }))
    ]);

    cachedIntakes = intakes || [];
    cachedProjects = projects || [];
    cachedSettings = settings?.integrations || {};

    const count = cachedIntakes.length;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <i data-lucide="inbox" class="w-5 h-5 text-indigo-600"></i>
              <span>SME Inbox & Source Intake (${count})</span>
            </h1>
            <p class="text-xs text-slate-500 mt-1">
              Capture incoming course material from Subject Matter Experts, audit completeness, and convert into production deliverables.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              id="record-new-sme-btn"
              onclick="openRecordSmeModal()"
              class="btn-primary text-xs py-2 px-3.5 inline-flex items-center gap-1.5"
            >
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>Record New SME Material</span>
            </button>
          </div>
        </div>

        <!-- Intake List -->
        ${count === 0 ? `
          <div class="white-card p-12 text-center space-y-3">
            <i data-lucide="inbox" class="w-10 h-10 text-slate-400 mx-auto"></i>
            <h3 class="text-base font-semibold text-slate-900">SME Inbox is currently empty</h3>
            <p class="text-xs text-slate-500 max-w-md mx-auto">
              When a Subject Matter Expert emails or hands off a PowerPoint, Word draft, or SOP, log it here to track its completeness and convert it into a production task.
            </p>
            <button onclick="openRecordSmeModal()" class="btn-primary text-xs mt-2">
              Record Incoming Material
            </button>
          </div>
        ` : `
          <div class="space-y-3" id="sme-intakes-list">
            ${cachedIntakes.map(intake => renderIntakeCard(intake)).join('')}
          </div>
        `}
      </div>
    `;

    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-rose-600 text-xs">Failed to load SME Inbox: ${err.message}</div>`;
  }
}

function renderIntakeCard(intake) {
  const receivedDate = intake.receivedDate ? new Date(intake.receivedDate) : new Date();
  const diffDays = Math.floor((new Date() - receivedDate) / (1000 * 60 * 60 * 24));
  const ageStr = diffDays <= 0 ? 'today' : `${diffDays}d ago`;
  const dateFormatted = receivedDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

  const completenessClass = intake.completeness === 'Complete'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : intake.completeness === 'Partial'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';

  const meetingScheduled = Boolean(intake.zoomMeetingUrl);
  let meetingTimeStr = '';
  if (intake.zoomMeetingTime) {
    const mt = new Date(intake.zoomMeetingTime);
    meetingTimeStr = mt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' at ' + mt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  return `
    <div class="white-card p-4 sm:p-5 transition-all ${intake.isConverted ? 'opacity-95' : 'hover:border-indigo-300'}" id="intake-card-${intake.id}">
      <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div class="space-y-2 max-w-3xl flex-1">
          <!-- Badges bar -->
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <span class="font-mono text-xs font-bold text-indigo-600">${intake.humanId}</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              ${intake.materialType || 'Material'} ${intake.version ? `v${intake.version}` : 'v1.0'}
            </span>
            ${intake.projectCode ? `
              <span class="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                ${intake.projectCode}
              </span>
            ` : ''}
            <span class="text-[10px] px-2 py-0.5 rounded font-semibold border ${completenessClass}">
              Completeness: ${intake.completeness || 'Partial'}
            </span>
            <span class="text-[10px] text-slate-500 flex items-center gap-1">
              <i data-lucide="clock" class="w-3 h-3 text-slate-400"></i>
              <span>Received ${ageStr} (${dateFormatted})</span>
            </span>
          </div>

          <!-- Title -->
          <h3 class="text-base font-bold text-slate-900 tracking-tight">
            ${escapeHtml(intake.title)}
          </h3>

          <!-- SME Sender info -->
          <p class="text-xs text-slate-500">
            SME: <span class="text-slate-800 font-medium">${escapeHtml(intake.senderName)}</span>
            ${intake.senderEmail ? ` (${escapeHtml(intake.senderEmail)})` : ''}
            ${intake.courseModuleName ? ` • Target: ${escapeHtml(intake.courseModuleName)}` : ''}
          </p>

          <!-- Source Summary -->
          ${intake.sourceSummary ? `
            <p class="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
              ${escapeHtml(intake.sourceSummary)}
            </p>
          ` : ''}

          <!-- Missing items / Content gaps -->
          ${intake.missingItems ? `
            <div class="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded">
              <span class="font-bold block uppercase text-[10px] tracking-wider mb-0.5">Content Gaps / Missing Items:</span>
              <p>${escapeHtml(intake.missingItems)}</p>
            </div>
          ` : ''}

          <!-- Clarification follow-up -->
          ${intake.clarificationNotes ? `
            <div class="text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 p-2.5 rounded">
              <span class="font-bold block uppercase text-[10px] tracking-wider mb-0.5">Clarification Follow-Up:</span>
              <p>${escapeHtml(intake.clarificationNotes)}</p>
            </div>
          ` : ''}

          <!-- Scheduled Zoom Meeting Banner -->
          ${meetingScheduled ? `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-900 mt-2">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded bg-blue-500 text-white flex items-center justify-center shrink-0">
                  <i data-lucide="video" class="w-3.5 h-3.5"></i>
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-xs text-blue-950">Zoom Walkthrough Scheduled</span>
                    ${meetingTimeStr ? `
                      <span class="text-[11px] text-blue-700 font-medium flex items-center gap-1">
                        <i data-lucide="calendar" class="w-3 h-3"></i>
                        <span>${meetingTimeStr}</span>
                      </span>
                    ` : ''}
                  </div>
                  <a
                    href="${escapeHtml(intake.zoomMeetingUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[11px] font-mono text-blue-700 hover:text-blue-900 underline inline-flex items-center gap-1 truncate max-w-xs sm:max-w-md"
                  >
                    <span>${escapeHtml(intake.zoomMeetingUrl)}</span>
                    <i data-lucide="external-link" class="w-3 h-3 shrink-0"></i>
                  </a>
                </div>
              </div>

              <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onclick="copyDirectZoomLink('${escapeQuotes(intake.zoomMeetingUrl)}')"
                  class="btn-secondary text-[11px] py-1 px-2.5 inline-flex items-center gap-1 bg-white hover:bg-blue-50 text-blue-700 border-blue-200"
                  title="Copy Zoom Link"
                >
                  <i data-lucide="copy" class="w-3 h-3"></i>
                  <span>Copy Link</span>
                </button>
                <a
                  href="${escapeHtml(intake.zoomMeetingUrl)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-primary text-[11px] py-1 px-2.5 inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 border-transparent text-white"
                >
                  <i data-lucide="video" class="w-3 h-3"></i>
                  <span>Join ↗</span>
                </a>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Right Action Buttons Column -->
        <div class="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2 shrink-0 pt-2 lg:pt-0">
          ${intake.isConverted ? `
            <div class="text-left lg:text-right space-y-1">
              <span class="text-xs px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold inline-flex items-center gap-1">
                <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                <span>Converted to Task</span>
              </span>
              ${intake.convertedTaskId ? `
                <div class="text-[11px] text-slate-500">
                  Linked:
                  <button
                    onclick="openTaskDetail('${intake.convertedTaskId}')"
                    class="font-mono text-indigo-600 hover:underline font-bold"
                  >
                    View Task →
                  </button>
                </div>
              ` : ''}
            </div>
          ` : `
            <button
              onclick="openConvertModal('${intake.id}')"
              class="btn-primary text-xs py-1.5 px-3.5 inline-flex items-center gap-1 w-full sm:w-auto"
            >
              <span>Convert to Deliverable</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          `}

          <button
            onclick="openScheduleZoomModal('${intake.id}')"
            class="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 text-blue-700 bg-blue-50/70 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors w-full sm:w-auto"
            title="Schedule Zoom meeting with this SME"
          >
            <i data-lucide="video" class="w-3.5 h-3.5 text-blue-600"></i>
            <span>${meetingScheduled ? (intake.zoomMeetingUrl ? 'Reschedule Zoom' : 'Update Zoom Review') : 'Schedule Zoom Review'}</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// Zoom Scheduling Modal Logic (element-for-element original)
// -------------------------------------------------------------
let activeZoomIntake = null;

function openScheduleZoomModal(intakeId) {
  const intake = cachedIntakes.find(i => i.id === intakeId);
  if (!intake) return;
  activeZoomIntake = intake;

  const defaultTopic = `[${intake.projectCode || 'Course'}] SME Review: ${intake.title}`;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;

  const agendaPoints = [
    `1. Walkthrough of received material: ${intake.title} (${intake.materialType || 'Material'} v${intake.version || '1.0'})`,
  ];
  if (intake.missingItems && intake.missingItems.trim()) {
    agendaPoints.push(`2. Clarify content gaps: ${intake.missingItems.trim()}`);
  }
  if (intake.clarificationNotes && intake.clarificationNotes.trim()) {
    agendaPoints.push(`3. Review follow-up points: ${intake.clarificationNotes.trim()}`);
  }
  agendaPoints.push('4. Delivery timeline and approval sign-off');

  const modal = document.getElementById('zoom-modal');
  if (!modal) return;

  const smeInfoEl = document.getElementById('zoom-modal-sme-info');
  if (smeInfoEl) {
    const senderName = intake.senderName || 'SME';
    const senderEmail = intake.senderEmail ? ` (${intake.senderEmail})` : '';
    smeInfoEl.innerHTML = `SME: <span class="font-semibold text-slate-800">${escapeHtml(senderName)}</span>${escapeHtml(senderEmail)}`;
  }

  document.getElementById('zoom-intake-id').value = intake.id;
  document.getElementById('zoom-topic').value = defaultTopic;
  document.getElementById('zoom-datetime').value = intake.zoomMeetingTime ? intake.zoomMeetingTime.slice(0, 16) : dateStr;
  document.getElementById('zoom-duration').value = '30';
  document.getElementById('zoom-agenda').value = agendaPoints.join('\n');

  const pmi = (cachedSettings.zoomDefaultPmi || '').trim();
  const passcode = (cachedSettings.zoomPasscode || 'idw123').trim();
  let defaultUrl = intake.zoomMeetingUrl || '';
  if (!defaultUrl && pmi) {
    const cleanDigits = pmi.replace(/\D/g, '');
    defaultUrl = `https://zoom.us/j/${cleanDigits || pmi}${passcode ? `?pwd=${encodeURIComponent(passcode)}` : ''}`;
  }

  document.getElementById('zoom-join-url').value = defaultUrl;
  document.getElementById('zoom-passcode').value = passcode;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeZoomModal() {
  const modal = document.getElementById('zoom-modal');
  if (modal) modal.classList.add('hidden');
  activeZoomIntake = null;
}

async function saveZoomMeetingFromModal() {
  const intakeId = document.getElementById('zoom-intake-id').value;
  const joinUrl = document.getElementById('zoom-join-url').value.trim();
  const dateTime = document.getElementById('zoom-datetime').value;

  if (!joinUrl) {
    Toast.error('Please enter a valid Zoom meeting URL or PMI link');
    return;
  }

  try {
    await API.post('api/sme.php?action=save_zoom_meeting', {
      intakeId,
      zoomMeetingUrl: joinUrl,
      zoomMeetingTime: dateTime || null
    });
    Toast.success('Zoom walkthrough meeting scheduled successfully');
    closeZoomModal();
    renderSmeInboxView(document.getElementById('view-container'));
  } catch (err) {
    Toast.error(err.message || 'Failed to save meeting');
  }
}

function formatZoomInvitationText() {
  const topic = document.getElementById('zoom-topic')?.value || '';
  const dt = document.getElementById('zoom-datetime')?.value || '';
  const duration = document.getElementById('zoom-duration')?.value || '30';
  const url = document.getElementById('zoom-join-url')?.value || '';
  const meetingId = document.getElementById('zoom-id')?.value || '';
  const passcode = document.getElementById('zoom-passcode')?.value || '';
  const agenda = document.getElementById('zoom-agenda')?.value || '';

  const dtFormatted = dt ? new Date(dt).toLocaleString() : 'TBD';
  const senderInfo = activeZoomIntake ? `${activeZoomIntake.senderName}${activeZoomIntake.senderEmail ? ` (${activeZoomIntake.senderEmail})` : ''}` : 'SME';

  return `Topic: ${topic}
Time: ${dtFormatted} (${duration} min)
SME: ${senderInfo}

Join Zoom Meeting:
${url || '[Zoom Meeting Link To Be Shared]'}
${meetingId ? `Meeting ID: ${meetingId}\n` : ''}${passcode ? `Passcode: ${passcode}\n` : ''}
Meeting Agenda:
${agenda}

---
Generated via ID Workbench SME Hub`;
}

function copyZoomInviteText() {
  const invite = formatZoomInvitationText();
  const label = document.getElementById('zoom-copy-invite-label');
  navigator.clipboard.writeText(invite).then(() => {
    Toast.success('Complete Zoom meeting invitation copied to clipboard!');
    if (label) {
      const orig = label.innerText;
      label.innerText = 'Copied!';
      setTimeout(() => { label.innerText = orig; }, 3000);
    }
  }).catch(() => {
    prompt('Copy invitation text below:', invite);
  });
}

function emailSmeInvite() {
  const topic = document.getElementById('zoom-topic')?.value || '';
  const invite = formatZoomInvitationText();
  const email = activeZoomIntake?.senderEmail?.trim() || '';
  window.open(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(topic)}&body=${encodeURIComponent(invite)}`, '_blank');
}

function launchZoom() {
  const url = document.getElementById('zoom-join-url')?.value?.trim();
  if (!url) {
    Toast.error('Please generate or enter a Zoom meeting URL first.');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

// -------------------------------------------------------------
// Record New SME Material Modal
// -------------------------------------------------------------
function openRecordSmeModal() {
  let modal = document.getElementById('record-sme-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'record-sme-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="white-card p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
          <i data-lucide="inbox" class="w-4 h-4 text-indigo-600"></i>
          <span>Record Incoming SME Material</span>
        </h3>
        <button onclick="closeRecordSmeModal()" class="text-slate-400 hover:text-slate-600">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <form id="record-sme-form" onsubmit="handleCreateSmeSubmit(event)" class="space-y-3.5 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Material Title *</label>
          <input
            type="text"
            id="sme-new-title"
            required
            placeholder="e.g. Sales Enablement Deck & Roleplay Scenarios"
            class="clean-input w-full"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">SME Sender Name *</label>
            <input
              type="text"
              id="sme-new-sender"
              required
              placeholder="e.g. Dr. Robert Chen"
              class="clean-input w-full"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">SME Email Address</label>
            <input
              type="email"
              id="sme-new-email"
              placeholder="e.g. rchen@enterprise.internal"
              class="clean-input w-full"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Associated Course</label>
            <select id="sme-new-project" class="clean-input w-full">
              <option value="">Unassigned</option>
              ${cachedProjects.map(p => `<option value="${p.id}">[${p.code}] ${p.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Material Type</label>
            <select id="sme-new-type" class="clean-input w-full">
              <option value="PowerPoint">PowerPoint (.pptx)</option>
              <option value="Word">Word Document (.docx)</option>
              <option value="PDF">PDF Handbook</option>
              <option value="Video">Video Recording</option>
              <option value="SCORM">SCORM / LMS Export</option>
              <option value="Notes">Raw Notes / Transcript</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Completeness</label>
            <select id="sme-new-completeness" class="clean-input w-full">
              <option value="Partial">Partial Draft</option>
              <option value="Complete">Complete Package</option>
              <option value="Minimal">Minimal Outline</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Target Module / Lesson</label>
          <input
            type="text"
            id="sme-new-module"
            placeholder="e.g. Module 3: Objection Handling"
            class="clean-input w-full"
          />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Source Summary</label>
          <textarea
            id="sme-new-summary"
            rows="2"
            placeholder="Brief overview of content, topics covered, and key objectives..."
            class="clean-input w-full"
          ></textarea>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Content Gaps / Missing Items</label>
          <textarea
            id="sme-new-missing"
            rows="2"
            placeholder="e.g. Missing quiz answer key, high-res diagrams on slide 14..."
            class="clean-input w-full"
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <button type="button" onclick="closeRecordSmeModal()" class="btn-secondary text-xs">
            Cancel
          </button>
          <button type="submit" class="btn-primary text-xs">
            Record Material
          </button>
        </div>
      </form>
    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeRecordSmeModal() {
  const modal = document.getElementById('record-sme-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleCreateSmeSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('sme-new-title').value.trim();
  const senderName = document.getElementById('sme-new-sender').value.trim();
  const senderEmail = document.getElementById('sme-new-email').value.trim();
  const projectId = document.getElementById('sme-new-project').value;
  const materialType = document.getElementById('sme-new-type').value;
  const completeness = document.getElementById('sme-new-completeness').value;
  const courseModuleName = document.getElementById('sme-new-module').value.trim();
  const sourceSummary = document.getElementById('sme-new-summary').value.trim();
  const missingItems = document.getElementById('sme-new-missing').value.trim();

  try {
    await API.post('api/sme.php', {
      title,
      senderName,
      senderEmail,
      projectId: projectId || null,
      materialType,
      completeness,
      courseModuleName,
      sourceSummary,
      missingItems,
      version: '1.0',
    });
    Toast.success('SME material recorded to inbox');
    closeRecordSmeModal();
    renderSmeInboxView(document.getElementById('view-container'));
  } catch (err) {
    Toast.error(err.message || 'Failed to record intake');
  }
}

// -------------------------------------------------------------
// Convert to Deliverable Modal
// -------------------------------------------------------------
function openConvertModal(intakeId) {
  const intake = cachedIntakes.find(i => i.id === intakeId);
  if (!intake) return;

  let modal = document.getElementById('convert-sme-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'convert-sme-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs';
    document.body.appendChild(modal);
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 14);
  const dueDefault = tomorrow.toISOString().slice(0, 10);

  modal.innerHTML = `
    <div class="white-card p-6 max-w-md w-full shadow-2xl space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
          <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i>
          <span>Convert Intake to Deliverable</span>
        </h3>
        <button onclick="closeConvertModal()" class="text-slate-400 hover:text-slate-600">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <form id="convert-form" onsubmit="handleConvertSubmit(event, '${intake.id}')" class="space-y-3.5 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Deliverable Title *</label>
          <input
            type="text"
            id="conv-title"
            required
            value="${escapeQuotes(intake.title)}"
            class="clean-input w-full"
          />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Target Course / Project *</label>
          <select id="conv-project" required class="clean-input w-full">
            ${cachedProjects.map(p => `
              <option value="${p.id}" ${intake.projectId === p.id ? 'selected' : ''}>
                [${p.code}] ${p.name}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Work Type</label>
            <select id="conv-type" class="clean-input w-full">
              <option value="Module" selected>Module</option>
              <option value="Storyboard">Storyboard</option>
              <option value="Video Script">Video Script</option>
              <option value="Assessment">Assessment</option>
              <option value="Job Aid">Job Aid</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Priority</label>
            <select id="conv-priority" class="clean-input w-full">
              <option value="Normal" selected>Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Due Date</label>
            <input
              type="date"
              id="conv-duedate"
              value="${dueDefault}"
              class="clean-input w-full"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Est. Hours</label>
            <input
              type="number"
              step="0.5"
              id="conv-hours"
              value="16.0"
              class="clean-input w-full"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <button type="button" onclick="closeConvertModal()" class="btn-secondary text-xs">
            Cancel
          </button>
          <button type="submit" class="btn-primary text-xs">
            Convert to Task
          </button>
        </div>
      </form>
    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeConvertModal() {
  const modal = document.getElementById('convert-sme-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleConvertSubmit(e, intakeId) {
  e.preventDefault();
  const title = document.getElementById('conv-title').value.trim();
  const projectId = document.getElementById('conv-project').value;
  const workType = document.getElementById('conv-type').value;
  const priority = document.getElementById('conv-priority').value;
  const dueDate = document.getElementById('conv-duedate').value;

  try {
    const res = await API.post('api/sme.php?action=convert_to_task', {
      intakeId,
      projectId,
      title,
      workType,
      priority,
      dueDate: dueDate || null
    });
    Toast.success(`Successfully converted to task ${res.humanId}!`);
    closeConvertModal();
    renderSmeInboxView(document.getElementById('view-container'));
  } catch (err) {
    Toast.error(err.message || 'Failed to convert intake');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeQuotes(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
