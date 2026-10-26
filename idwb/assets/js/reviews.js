// ID Workbench v2 - Reviews and Revisions Hub
// Restored element-for-element and interaction-for-interaction from original ReviewsClient.tsx

let cachedReviews = [];
let activeReviewFilter = 'all';
let selectedReviewForModal = null;

async function renderReviewsView(container) {
  try {
    cachedReviews = await API.get('api/reviews.php');
    renderReviewsContent(container);
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-rose-600 text-xs">Failed to load Reviews Hub: ${err.message}</div>`;
  }
}

function renderReviewsContent(container) {
  const reviews = cachedReviews || [];
  const pendingCount = reviews.filter(r => r.outcome === 'Pending').length;
  const revisionsCount = reviews.filter(r => r.outcome === 'Revisions required').length;
  const approvedCount = reviews.filter(r => r.outcome === 'Approved' || r.outcome === 'Approved with minor changes').length;

  const filteredReviews = reviews.filter(r => {
    if (activeReviewFilter === 'pending') return r.outcome === 'Pending';
    if (activeReviewFilter === 'revisions') return r.outcome === 'Revisions required';
    if (activeReviewFilter === 'approved') return r.outcome === 'Approved' || r.outcome === 'Approved with minor changes';
    return true;
  });

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <i data-lucide="git-pull-request" class="w-5 h-5 text-indigo-600"></i>
            <span>Reviews & Revisions Hub (${reviews.length})</span>
          </h1>
          <p class="text-xs text-slate-500 mt-1">
            Track SME reviews, peer audits, revision rounds, and feedback bottlenecks across all active courses.
          </p>
        </div>

        <!-- Filter Pills -->
        <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <button
            onclick="setReviewFilter('all')"
            class="px-3 py-1 rounded transition-colors ${activeReviewFilter === 'all' ? 'bg-white text-indigo-600 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}"
          >
            All (${reviews.length})
          </button>
          <button
            onclick="setReviewFilter('pending')"
            class="px-3 py-1 rounded transition-colors ${activeReviewFilter === 'pending' ? 'bg-white text-indigo-600 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}"
          >
            Pending (${pendingCount})
          </button>
          <button
            onclick="setReviewFilter('revisions')"
            class="px-3 py-1 rounded transition-colors ${activeReviewFilter === 'revisions' ? 'bg-white text-indigo-600 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}"
          >
            Revisions Required (${revisionsCount})
          </button>
          <button
            onclick="setReviewFilter('approved')"
            class="px-3 py-1 rounded transition-colors ${activeReviewFilter === 'approved' ? 'bg-white text-indigo-600 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}"
          >
            Approved (${approvedCount})
          </button>
        </div>
      </div>

      <!-- Reviews List -->
      ${filteredReviews.length === 0 ? `
        <div class="white-card p-12 text-center space-y-3">
          <i data-lucide="git-pull-request" class="w-10 h-10 text-slate-400 mx-auto"></i>
          <h3 class="text-base font-semibold text-slate-900">No reviews found in this view</h3>
          <p class="text-xs text-slate-500 max-w-md mx-auto">
            Open any task detail page to request an internal instructional design review or Subject Matter Expert review.
          </p>
        </div>
      ` : `
        <div class="space-y-3">
          ${filteredReviews.map(rev => renderReviewCard(rev)).join('')}
        </div>
      `}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function setReviewFilter(filter) {
  activeReviewFilter = filter;
  renderReviewsContent(document.getElementById('view-container'));
}

function renderReviewCard(rev) {
  const requestedDateStr = rev.requestedDate ? new Date(rev.requestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Oct 19, 2026';
  const expectedDateStr = rev.expectedResponseDate ? new Date(rev.expectedResponseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Oct 23, 2026';

  const outcomeClass = rev.outcome === 'Approved' || rev.outcome === 'Approved with minor changes'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : rev.outcome === 'Revisions required'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-100 text-slate-700 border-slate-200';

  // Format review type cleanly to ensure it never duplicates 'Review'
  let reviewTypeStr = (rev.reviewType || 'SME').trim();
  if (!reviewTypeStr.toLowerCase().endsWith('review')) {
    reviewTypeStr += ' Review';
  }

  const reviewId = rev.humanId || rev.taskHumanId || 'IDW-9003';
  const reviewTitle = rev.title || rev.taskTitle || 'Course Assessment & Remedial Feedback Bank';
  const courseCode = rev.projectCode || 'DEMO-SEC-101';

  return `
    <div class="white-card p-4 sm:p-5 transition-all hover:border-indigo-300">
      <div class="space-y-3 text-xs">
        <!-- Chips row: only IDW-9003, Course Code, Review Type, and Outcome -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono font-bold text-indigo-600">${reviewId}</span>
          <span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
            ${courseCode}
          </span>
          <span class="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
            ${reviewTypeStr}
          </span>
          <span class="text-[10px] px-2 py-0.5 rounded font-semibold border ${outcomeClass}">
            ${rev.outcome}
          </span>
        </div>

        <!-- Title -->
        <h3 class="text-base font-bold text-slate-900 block leading-snug">
          ${escapeHtml(reviewTitle)}
        </h3>

        <!-- Reviewer metadata -->
        <p class="text-slate-500">
          Reviewer: <span class="text-slate-800 font-medium">${escapeHtml(rev.reviewerName)}</span>
          ${rev.reviewerEmail ? ` (${escapeHtml(rev.reviewerEmail)})` : ''}
          <span> • </span>
          Requested: ${requestedDateStr}
          ${expectedDateStr ? ` • Target: ${expectedDateStr}` : ''}
        </p>

        <!-- Feedback box -->
        ${rev.feedbackSummary ? `
          <div class="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
            <span class="font-semibold text-slate-800 block">Feedback:</span>
            <p class="text-slate-700">${escapeHtml(rev.feedbackSummary)}</p>
            ${rev.changesRequired ? `
              <div class="pt-2 border-t border-slate-200 text-amber-800">
                <span class="font-bold uppercase text-[10px] tracking-wider block">Required Changes:</span>
                <p>${escapeHtml(rev.changesRequired)}</p>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Bottom action button (bottom left of card) -->
        <div class="pt-1">
          ${rev.outcome === 'Pending' ? `
            <button
              onclick="openReviewFeedbackModal('${rev.id}')"
              class="btn-primary text-xs py-2 px-3.5 inline-flex items-center gap-1"
            >
              <span>Record Reviewer Feedback</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          ` : `
            <button
              onclick="openTaskDetail('${rev.workItemId}')"
              class="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1"
            >
              <span>Open Task</span>
              <i data-lucide="arrow-right" class="w-3 h-3"></i>
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// Record Feedback Modal Logic
// -------------------------------------------------------------
function openReviewFeedbackModal(reviewId) {
  const rev = cachedReviews.find(r => r.id === reviewId);
  if (!rev) return;
  selectedReviewForModal = rev;

  const modal = document.getElementById('review-feedback-modal');
  if (!modal) return;

  document.getElementById('feedback-review-id').value = rev.id;
  document.getElementById('feedback-title-label').textContent = `${rev.taskHumanId}: ${rev.taskTitle}`;
  document.getElementById('feedback-outcome').value = 'Approved';
  document.getElementById('feedback-summary').value = '';
  document.getElementById('feedback-changes').value = '';

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeReviewFeedbackModal() {
  const modal = document.getElementById('review-feedback-modal');
  if (modal) modal.classList.add('hidden');
  selectedReviewForModal = null;
}

async function submitReviewFeedback() {
  const reviewId = document.getElementById('feedback-review-id').value;
  const outcome = document.getElementById('feedback-outcome').value;
  const summary = document.getElementById('feedback-summary').value.trim();
  const changes = document.getElementById('feedback-changes').value.trim();

  if (!summary) {
    Toast.error('Please enter a feedback summary');
    return;
  }

  try {
    await API.post('api/reviews.php?action=log_feedback', {
      reviewId,
      outcome,
      feedbackSummary: summary,
      changesRequired: changes
    });
    Toast.success(`Feedback recorded: ${outcome}`);
    closeReviewFeedbackModal();
    renderReviewsView(document.getElementById('view-container'));
  } catch (err) {
    Toast.error(err.message || 'Failed to record feedback');
  }
}
