<?php
// ID Workbench v2 - Reviews and Revisions API
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../lib/helpers.php';

$user = require_auth();
$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $outcome = trim($_GET['outcome'] ?? '');
    $workItemId = trim($_GET['workItemId'] ?? '');

    $sql = "
        SELECT r.*, COALESCE(r.humanId, w.humanId) as taskHumanId, COALESCE(r.title, w.title) as taskTitle, w.projectId, p.name as projectName, p.code as projectCode
        FROM Review r
        JOIN WorkItem w ON r.workItemId = w.id
        JOIN Project p ON w.projectId = p.id
        WHERE w.isArchived = 0
    ";
    $params = [];

    if ($outcome !== '') {
        $sql .= " AND r.outcome = ?";
        $params[] = $outcome;
    }
    if ($workItemId !== '') {
        $sql .= " AND r.workItemId = ?";
        $params[] = $workItemId;
    }

    $sql .= " ORDER BY r.requestedDate DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $reviews = $stmt->fetchAll();

    foreach ($reviews as &$rev) {
        $roundStmt = $pdo->prepare("SELECT * FROM RevisionRound WHERE reviewId = ? ORDER BY roundNumber ASC");
        $roundStmt->execute([$rev['id']]);
        $rev['revisionRounds'] = $roundStmt->fetchAll();
    }
    unset($rev);

    json_response($reviews);
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = get_json_input();

if ($action === 'log_feedback') {
    $reviewId = $input['reviewId'] ?? null;
    $outcome = $input['outcome'] ?? 'Approved';
    $feedbackSummary = trim($input['feedbackSummary'] ?? '');
    $changesRequired = trim($input['changesRequired'] ?? '');

    if (!$reviewId) json_error('Review ID is required', 400);

    $stmt = $pdo->prepare("SELECT r.*, w.title as taskTitle, w.projectId FROM Review r JOIN WorkItem w ON r.workItemId = w.id WHERE r.id = ?");
    $stmt->execute([$reviewId]);
    $review = $stmt->fetch();
    if (!$review) json_error('Review not found', 404);

    $isResolved = ($outcome === 'Approved' || $outcome === 'Approved with minor changes') ? 1 : 0;

    $upd = $pdo->prepare("
        UPDATE Review 
        SET outcome = ?, feedbackSummary = ?, changesRequired = ?, feedbackReceivedDate = CURRENT_TIMESTAMP, isResolved = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
    ");
    $upd->execute([$outcome, $feedbackSummary, $changesRequired, $isResolved, $reviewId]);

    // If revisions required, increment revision round on task and update stage
    if ($outcome === 'Revisions required' || $outcome === 'Rejected / needs redesign') {
        $pdo->prepare("
            UPDATE WorkItem 
            SET workflowStage = 'Revisions Required', status = 'In Progress', revisionRoundCount = revisionRoundCount + 1, feedbackReceivedDate = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP 
            WHERE id = ?
        ")->execute([$review['workItemId']]);

        // Add Revision Round record
        $roundNum = (int)$pdo->query("SELECT COUNT(*) FROM RevisionRound WHERE workItemId = '{$review['workItemId']}'")->fetchColumn() + 1;
        $pdo->prepare("
            INSERT INTO RevisionRound (id, workItemId, reviewId, roundNumber, feedbackSummary, changesRequired, owner, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ")->execute([
            generate_id(),
            $review['workItemId'],
            $reviewId,
            $roundNum,
            $feedbackSummary,
            $changesRequired,
            $user['email']
        ]);
    } else {
        $pdo->prepare("
            UPDATE WorkItem 
            SET feedbackReceivedDate = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP 
            WHERE id = ?
        ")->execute([$review['workItemId']]);
    }

    log_activity(
        $pdo,
        'FEEDBACK_LOGGED',
        "Review feedback recorded ({$outcome})",
        $feedbackSummary,
        $review['workItemId'],
        $review['projectId']
    );

    json_response(['success' => true, 'outcome' => $outcome]);
}

if ($method === 'POST') {
    $workItemId = $input['workItemId'] ?? null;
    $reviewType = $input['reviewType'] ?? 'Internal';
    $reviewerName = trim($input['reviewerName'] ?? '');
    $reviewerEmail = trim($input['reviewerEmail'] ?? '');
    $expectedDate = !empty($input['expectedResponseDate']) ? $input['expectedResponseDate'] : null;

    if (!$workItemId || !$reviewerName) {
        json_error('Task and reviewer name are required', 400);
    }

    $stmt = $pdo->prepare("SELECT id, title, projectId FROM WorkItem WHERE id = ?");
    $stmt->execute([$workItemId]);
    $task = $stmt->fetch();
    if (!$task) json_error('Deliverable not found', 404);

    $revId = generate_id();
    $ins = $pdo->prepare("
        INSERT INTO Review (id, workItemId, reviewType, reviewerName, reviewerEmail, expectedResponseDate, outcome, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 'Pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ");
    $ins->execute([$revId, $workItemId, $reviewType, $reviewerName, $reviewerEmail, $expectedDate]);

    // Update deliverable stage & dates
    $newStage = ($reviewType === 'SME') ? 'Awaiting SME Review' : 'Awaiting Internal Review';
    $pdo->prepare("
        UPDATE WorkItem 
        SET workflowStage = ?, reviewRequestedDate = CURRENT_TIMESTAMP, feedbackReceivedDate = NULL, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
    ")->execute([$newStage, $workItemId]);

    log_activity(
        $pdo,
        'REVIEW_REQUESTED',
        "Requested {$reviewType} Review",
        "Assigned to {$reviewerName}",
        $workItemId,
        $task['projectId']
    );

    json_response(['success' => true, 'id' => $revId], 201);
}

json_error('Method not supported', 405);
