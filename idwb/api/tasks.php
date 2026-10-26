<?php
// ID Workbench v2 - Deliverables / Tasks API
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/health.php';

$user = require_auth();
$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET single task or task list
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;

    if ($id) {
        $stmt = $pdo->prepare("
            SELECT w.*, p.name as projectName, p.code as projectCode, p.smeName as projectSmeName, p.smeEmail as projectSmeEmail
            FROM WorkItem w
            JOIN Project p ON w.projectId = p.id
            WHERE (w.id = ? OR w.humanId = ?) AND w.isArchived = 0
        ");
        $stmt->execute([$id, $id]);
        $task = $stmt->fetch();

        if (!$task) {
            json_error('Deliverable not found', 404);
        }

        $task['health'] = compute_task_health($task);
        $task['tags'] = json_decode($task['tags'] ?: '[]', true);

        // Fetch QA checks
        $qaStmt = $pdo->prepare("SELECT * FROM QACheck WHERE workItemId = ? ORDER BY id ASC");
        $qaStmt->execute([$task['id']]);
        $task['qaChecks'] = $qaStmt->fetchAll();

        // Fetch Reviews and their revision rounds
        $revStmt = $pdo->prepare("SELECT * FROM Review WHERE workItemId = ? ORDER BY requestedDate DESC");
        $revStmt->execute([$task['id']]);
        $reviews = $revStmt->fetchAll();

        foreach ($reviews as &$rev) {
            $roundsStmt = $pdo->prepare("SELECT * FROM RevisionRound WHERE reviewId = ? ORDER BY roundNumber ASC");
            $roundsStmt->execute([$rev['id']]);
            $rev['revisionRounds'] = $roundsStmt->fetchAll();
        }
        unset($rev);
        $task['reviews'] = $reviews;

        // Fetch Delivery records
        $delStmt = $pdo->prepare("SELECT * FROM DeliveryRecord WHERE workItemId = ? ORDER BY deliveryDate DESC");
        $delStmt->execute([$task['id']]);
        $task['deliveryRecords'] = $delStmt->fetchAll();

        // Fetch Activity History
        $actStmt = $pdo->prepare("SELECT * FROM ActivityEvent WHERE workItemId = ? ORDER BY createdAt DESC LIMIT 20");
        $actStmt->execute([$task['id']]);
        $task['activityEvents'] = $actStmt->fetchAll();

        json_response($task);
    }

    // List tasks with query filtering
    $search = trim($_GET['search'] ?? '');
    $stage = trim($_GET['stage'] ?? '');
    $status = trim($_GET['status'] ?? '');
    $priority = trim($_GET['priority'] ?? '');
    $projectId = trim($_GET['projectId'] ?? '');
    $healthFilter = trim($_GET['health'] ?? '');

    $sql = "
        SELECT w.*, p.name as projectName, p.code as projectCode
        FROM WorkItem w
        JOIN Project p ON w.projectId = p.id
        WHERE w.isArchived = 0
    ";
    $params = [];

    if ($search !== '') {
        $sql .= " AND (w.title LIKE ? OR w.humanId LIKE ? OR w.description LIKE ? OR w.smeName LIKE ?)";
        $term = "%{$search}%";
        $params = array_merge($params, [$term, $term, $term, $term]);
    }
    if ($stage !== '') {
        $sql .= " AND w.workflowStage = ?";
        $params[] = $stage;
    }
    if ($status !== '') {
        $sql .= " AND w.status = ?";
        $params[] = $status;
    }
    if ($priority !== '') {
        $sql .= " AND w.priority = ?";
        $params[] = $priority;
    }
    if ($projectId !== '') {
        $sql .= " AND w.projectId = ?";
        $params[] = $projectId;
    }

    $sql .= " ORDER BY w.updatedAt DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $tasks = $stmt->fetchAll();

    $filtered = [];
    foreach ($tasks as &$t) {
        $t['health'] = compute_task_health($t);
        $t['tags'] = json_decode($t['tags'] ?: '[]', true);

        if ($healthFilter !== '') {
            if ($healthFilter === 'overdue' && !$t['health']['isOverdue']) continue;
            if ($healthFilter === 'blocked' && !$t['health']['isBlocked']) continue;
            if ($healthFilter === 'waiting' && !$t['health']['isWaitingOnSME']) continue;
            if ($healthFilter === 'due_soon' && !$t['health']['isDueSoon']) continue;
            if ($healthFilter === 'attention' && !($t['health']['isAtRisk'] || $t['health']['isBlocked'] || $t['health']['isOverdue'] || $t['health']['isWaitingOnSME'])) continue;
        }

        $filtered[] = $t;
    }
    unset($t);

    json_response($filtered);
}

// POST create or actions
$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = get_json_input();

if ($action === 'update_stage') {
    $taskId = $input['id'] ?? null;
    $newStage = $input['workflowStage'] ?? null;

    if (!$taskId || !$newStage || !in_array($newStage, WORKFLOW_STAGES, true)) {
        json_error('Valid taskId and workflowStage required', 400);
    }

    $stmt = $pdo->prepare("SELECT id, humanId, title, projectId, workflowStage, status FROM WorkItem WHERE id = ?");
    $stmt->execute([$taskId]);
    $curr = $stmt->fetch();
    if (!$curr) json_error('Task not found', 404);

    $prevStage = $curr['workflowStage'];
    $newStatus = $curr['status'];
    if ($newStage === 'Delivered') {
        $newStatus = 'Completed';
    } elseif ($curr['status'] === 'Completed' && $newStage !== 'Delivered') {
        $newStatus = 'In Progress';
    }

    $upd = $pdo->prepare("
        UPDATE WorkItem 
        SET workflowStage = ?, status = ?, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
    ");
    $upd->execute([$newStage, $newStatus, $taskId]);

    log_activity(
        $pdo,
        'STAGE_CHANGED',
        "Stage updated to {$newStage}",
        "Moved deliverable from {$prevStage} to {$newStage}",
        $taskId,
        $curr['projectId'],
        $prevStage,
        $newStage
    );

    json_response(['success' => true, 'newStage' => $newStage, 'status' => $newStatus]);
}

if ($action === 'toggle_block') {
    $taskId = $input['id'] ?? null;
    $isBlocked = !empty($input['isBlocked']) ? 1 : 0;
    $reason = trim($input['blockerReason'] ?? '');

    $stmt = $pdo->prepare("SELECT id, humanId, title, projectId FROM WorkItem WHERE id = ?");
    $stmt->execute([$taskId]);
    $task = $stmt->fetch();
    if (!$task) json_error('Task not found', 404);

    $pdo->prepare("
        UPDATE WorkItem 
        SET isBlocked = ?, blockerReason = ?, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
    ")->execute([$isBlocked, $isBlocked ? $reason : null, $taskId]);

    log_activity(
        $pdo,
        $isBlocked ? 'BLOCKED' : 'UNBLOCKED',
        $isBlocked ? "Deliverable blocked: {$reason}" : "Deliverable unblocked",
        $reason,
        $taskId,
        $task['projectId']
    );

    json_response(['success' => true, 'isBlocked' => (bool)$isBlocked]);
}

if ($method === 'POST' || $method === 'PUT') {
    $isUpdate = !empty($input['id']);
    $title = trim($input['title'] ?? '');
    $projectId = trim($input['projectId'] ?? '');

    if (!$title) {
        json_error('Deliverable title is required', 400);
    }

    if ($isUpdate) {
        $taskId = $input['id'];
        $stmt = $pdo->prepare("SELECT id, humanId, projectId FROM WorkItem WHERE id = ?");
        $stmt->execute([$taskId]);
        $existing = $stmt->fetch();
        if (!$existing) json_error('Task not found', 404);

        $updStmt = $pdo->prepare("
            UPDATE WorkItem SET
                title = :title,
                description = :description,
                projectId = :projectId,
                moduleLesson = :moduleLesson,
                workType = :workType,
                priority = :priority,
                workflowStage = :workflowStage,
                status = :status,
                assignedOwner = :assignedOwner,
                tags = :tags,
                dueDate = :dueDate,
                plannedStartDate = :plannedStartDate,
                estimatedHours = :estimatedHours,
                actualHours = :actualHours,
                progress = :progress,
                smeName = :smeName,
                smeContact = :smeContact,
                isBlocked = :isBlocked,
                blockerReason = :blockerReason,
                nextAction = :nextAction,
                scormRequirement = :scormRequirement,
                lmsTarget = :lmsTarget,
                updatedAt = CURRENT_TIMESTAMP
            WHERE id = :id
        ");

        $updStmt->execute([
            ':title' => $title,
            ':description' => $input['description'] ?? null,
            ':projectId' => $projectId ?: $existing['projectId'],
            ':moduleLesson' => $input['moduleLesson'] ?? null,
            ':workType' => $input['workType'] ?? 'Module',
            ':priority' => $input['priority'] ?? 'Normal',
            ':workflowStage' => $input['workflowStage'] ?? 'New SME Material Received',
            ':status' => $input['status'] ?? 'Active',
            ':assignedOwner' => $input['assignedOwner'] ?? $user['email'],
            ':tags' => json_encode($input['tags'] ?? []),
            ':dueDate' => !empty($input['dueDate']) ? $input['dueDate'] : null,
            ':plannedStartDate' => !empty($input['plannedStartDate']) ? $input['plannedStartDate'] : null,
            ':estimatedHours' => !empty($input['estimatedHours']) ? (float)$input['estimatedHours'] : null,
            ':actualHours' => !empty($input['actualHours']) ? (float)$input['actualHours'] : null,
            ':progress' => isset($input['progress']) ? (int)$input['progress'] : 0,
            ':smeName' => $input['smeName'] ?? null,
            ':smeContact' => $input['smeContact'] ?? null,
            ':isBlocked' => !empty($input['isBlocked']) ? 1 : 0,
            ':blockerReason' => !empty($input['isBlocked']) ? ($input['blockerReason'] ?? null) : null,
            ':nextAction' => $input['nextAction'] ?? null,
            ':scormRequirement' => $input['scormRequirement'] ?? null,
            ':lmsTarget' => $input['lmsTarget'] ?? null,
            ':id' => $taskId,
        ]);

        log_activity($pdo, 'UPDATED', "Deliverable updated", "Saved changes for {$title}", $taskId, $projectId ?: $existing['projectId']);

        json_response(['success' => true, 'id' => $taskId]);
    } else {
        // Create new Deliverable
        if (!$projectId) {
            $firstProj = $pdo->query("SELECT id FROM Project WHERE isArchived = 0 ORDER BY createdAt ASC LIMIT 1")->fetchColumn();
            if (!$firstProj) json_error('At least one active project is required', 400);
            $projectId = $firstProj;
        }

        $maxNumber = (int)$pdo->query("SELECT COALESCE(MAX(itemNumber), 0) FROM WorkItem")->fetchColumn();
        $nextNumber = $maxNumber + 1;
        $humanId = sprintf("IDW-%04d", $nextNumber);
        $newId = generate_id();

        $insertStmt = $pdo->prepare("
            INSERT INTO WorkItem (
                id, itemNumber, humanId, title, description, projectId, moduleLesson, workType, priority,
                workflowStage, status, assignedOwner, tags, dueDate, plannedStartDate, estimatedHours,
                progress, smeName, smeContact, isBlocked, blockerReason, nextAction, scormRequirement, lmsTarget,
                createdAt, updatedAt
            ) VALUES (
                :id, :itemNumber, :humanId, :title, :description, :projectId, :moduleLesson, :workType, :priority,
                :workflowStage, :status, :assignedOwner, :tags, :dueDate, :plannedStartDate, :estimatedHours,
                :progress, :smeName, :smeContact, :isBlocked, :blockerReason, :nextAction, :scormRequirement, :lmsTarget,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
        ");

        $insertStmt->execute([
            ':id' => $newId,
            ':itemNumber' => $nextNumber,
            ':humanId' => $humanId,
            ':title' => $title,
            ':description' => $input['description'] ?? null,
            ':projectId' => $projectId,
            ':moduleLesson' => $input['moduleLesson'] ?? null,
            ':workType' => $input['workType'] ?? 'Module',
            ':priority' => $input['priority'] ?? 'Normal',
            ':workflowStage' => $input['workflowStage'] ?? 'New SME Material Received',
            ':status' => $input['status'] ?? 'Active',
            ':assignedOwner' => $input['assignedOwner'] ?? $user['email'],
            ':tags' => json_encode($input['tags'] ?? []),
            ':dueDate' => !empty($input['dueDate']) ? $input['dueDate'] : null,
            ':plannedStartDate' => !empty($input['plannedStartDate']) ? $input['plannedStartDate'] : null,
            ':estimatedHours' => !empty($input['estimatedHours']) ? (float)$input['estimatedHours'] : null,
            ':progress' => isset($input['progress']) ? (int)$input['progress'] : 0,
            ':smeName' => $input['smeName'] ?? null,
            ':smeContact' => $input['smeContact'] ?? null,
            ':isBlocked' => !empty($input['isBlocked']) ? 1 : 0,
            ':blockerReason' => !empty($input['isBlocked']) ? ($input['blockerReason'] ?? null) : null,
            ':nextAction' => $input['nextAction'] ?? null,
            ':scormRequirement' => $input['scormRequirement'] ?? null,
            ':lmsTarget' => $input['lmsTarget'] ?? null,
        ]);

        // Auto-seed the 12 QA items for this deliverable
        $qaInsert = $pdo->prepare("
            INSERT INTO QACheck (id, workItemId, checkKey, title, category, status, isRequired, updatedAt)
            VALUES (?, ?, ?, ?, ?, 'Not started', ?, CURRENT_TIMESTAMP)
        ");
        foreach (DEFAULT_QA_ITEMS as $item) {
            $qaInsert->execute([
                generate_id(),
                $newId,
                $item['checkKey'],
                $item['title'],
                $item['category'],
                $item['isRequired'] ? 1 : 0
            ]);
        }

        log_activity($pdo, 'CREATED', "Created Deliverable {$humanId}", $title, $newId, $projectId);

        json_response([
            'success' => true,
            'id' => $newId,
            'humanId' => $humanId,
            'title' => $title
        ], 201);
    }
}

json_error('Method not supported', 405);
