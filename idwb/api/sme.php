<?php
// ID Workbench v2 - SME Inbox API
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../lib/helpers.php';

$user = require_auth();
$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = trim($_GET['status'] ?? '');
    $projectId = trim($_GET['projectId'] ?? '');

    $sql = "
        SELECT s.*, p.code as projectCode, p.name as projectName
        FROM SMEIntake s
        LEFT JOIN Project p ON s.projectId = p.id
        WHERE s.isArchived = 0
    ";
    $params = [];

    if ($status !== '') {
        $sql .= " AND s.status = ?";
        $params[] = $status;
    }
    if ($projectId !== '') {
        $sql .= " AND s.projectId = ?";
        $params[] = $projectId;
    }

    $sql .= " ORDER BY s.receivedDate DESC, s.intakeNumber DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    json_response($items);
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = get_json_input();

if ($action === 'convert_to_task') {
    $intakeId = $input['intakeId'] ?? null;
    $projectId = $input['projectId'] ?? null;
    $title = trim($input['title'] ?? '');
    $workType = $input['workType'] ?? 'Module';
    $priority = $input['priority'] ?? 'Normal';
    $dueDate = !empty($input['dueDate']) ? $input['dueDate'] : null;

    if (!$intakeId) json_error('Intake ID is required', 400);

    $stmt = $pdo->prepare("SELECT * FROM SMEIntake WHERE id = ?");
    $stmt->execute([$intakeId]);
    $intake = $stmt->fetch();
    if (!$intake) json_error('SME intake record not found', 404);

    $resolvedProjectId = $projectId ?: $intake['projectId'];
    if (!$resolvedProjectId) {
        $resolvedProjectId = $pdo->query("SELECT id FROM Project WHERE isArchived = 0 ORDER BY createdAt ASC LIMIT 1")->fetchColumn();
    }

    $taskTitle = $title ?: $intake['title'];
    $maxNumber = (int)$pdo->query("SELECT COALESCE(MAX(itemNumber), 0) FROM WorkItem")->fetchColumn();
    $nextNumber = $maxNumber + 1;
    $humanId = sprintf("IDW-%04d", $nextNumber);
    $newTaskId = generate_id();

    // Create WorkItem linked to SME Intake
    $createTask = $pdo->prepare("
        INSERT INTO WorkItem (
            id, itemNumber, humanId, title, description, projectId, workType, priority,
            workflowStage, status, assignedOwner, smeIntakeId, smeName, smeContact,
            sourceMaterialType, sourceSummary, dueDate, createdAt, updatedAt
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            'Intake / Source Review', 'Active', ?, ?, ?, ?,
            ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    ");
    $createTask->execute([
        $newTaskId,
        $nextNumber,
        $humanId,
        $taskTitle,
        $intake['sourceSummary'],
        $resolvedProjectId,
        $workType,
        $priority,
        $user['email'],
        $intakeId,
        $intake['senderName'],
        $intake['senderEmail'],
        $intake['materialType'],
        $intake['sourceSummary'],
        $dueDate
    ]);

    // Seed QA checks for the new task
    $qaInsert = $pdo->prepare("
        INSERT INTO QACheck (id, workItemId, checkKey, title, category, status, isRequired, updatedAt)
        VALUES (?, ?, ?, ?, ?, 'Not started', ?, CURRENT_TIMESTAMP)
    ");
    foreach (DEFAULT_QA_ITEMS as $item) {
        $qaInsert->execute([
            generate_id(),
            $newTaskId,
            $item['checkKey'],
            $item['title'],
            $item['category'],
            $item['isRequired'] ? 1 : 0
        ]);
    }

    // Mark intake as converted
    $pdo->prepare("
        UPDATE SMEIntake 
        SET isConverted = 1, convertedTaskId = ?, status = 'Converted', updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
    ")->execute([$newTaskId, $intakeId]);

    log_activity(
        $pdo,
        'CREATED',
        "Converted SME Intake to {$humanId}",
        "Converted '{$intake['title']}' into task {$humanId}",
        $newTaskId,
        $resolvedProjectId
    );

    json_response([
        'success' => true,
        'taskId' => $newTaskId,
        'humanId' => $humanId,
        'intakeId' => $intakeId
    ]);
}

if ($action === 'save_zoom_meeting') {
    $intakeId = $input['intakeId'] ?? null;
    $meetingUrl = trim($input['zoomMeetingUrl'] ?? '');
    $meetingTime = !empty($input['zoomMeetingTime']) ? $input['zoomMeetingTime'] : null;

    if (!$intakeId) json_error('Intake ID is required', 400);

    $stmt = $pdo->prepare("UPDATE SMEIntake SET zoomMeetingUrl = ?, zoomMeetingTime = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([$meetingUrl ?: null, $meetingTime, $intakeId]);

    log_activity(
        $pdo,
        'UPDATED',
        "Zoom Meeting Scheduled",
        "Updated Zoom meeting walkthrough link for intake",
        null,
        null
    );

    json_response(['success' => true]);
}

if ($method === 'POST') {
    $title = trim($input['title'] ?? '');
    $senderName = trim($input['senderName'] ?? '');
    if (!$title || !$senderName) {
        json_error('Title and sender name are required', 400);
    }

    $maxNum = (int)$pdo->query("SELECT COALESCE(MAX(intakeNumber), 0) FROM SMEIntake")->fetchColumn();
    $nextNum = $maxNum + 1;
    $humanId = sprintf("INT-%04d", $nextNum);
    $intakeId = generate_id();

    $stmt = $pdo->prepare("
        INSERT INTO SMEIntake (
            id, intakeNumber, humanId, title, senderName, senderEmail, projectId,
            courseModuleName, materialType, version, sourceSummary, expectedOutput,
            dueDate, completeness, missingItems, clarificationNotes, status, notes, zoomMeetingUrl, zoomMeetingTime, createdAt, updatedAt
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    ");
    $stmt->execute([
        $intakeId,
        $nextNum,
        $humanId,
        $title,
        $senderName,
        $input['senderEmail'] ?? null,
        $input['projectId'] ?? null,
        $input['courseModuleName'] ?? null,
        $input['materialType'] ?? 'Word',
        $input['version'] ?? '1.0',
        $input['sourceSummary'] ?? null,
        $input['expectedOutput'] ?? null,
        !empty($input['dueDate']) ? $input['dueDate'] : null,
        $input['completeness'] ?? 'Partial',
        $input['missingItems'] ?? null,
        $input['clarificationNotes'] ?? null,
        $input['status'] ?? 'New',
        $input['notes'] ?? null,
        $input['zoomMeetingUrl'] ?? null,
        !empty($input['zoomMeetingTime']) ? $input['zoomMeetingTime'] : null,
    ]);

    log_activity(
        $pdo,
        'CREATED',
        "New SME Material: {$humanId}",
        "Logged incoming material '{$title}' from {$senderName}",
        null,
        $input['projectId'] ?? null
    );

    json_response(['success' => true, 'id' => $intakeId, 'humanId' => $humanId], 201);
}

json_error('Method not supported', 405);
