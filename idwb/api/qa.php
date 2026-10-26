<?php
// ID Workbench v2 - QA Delivery Gate API
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../lib/helpers.php';

$user = require_auth();
$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $taskId = trim($_GET['taskId'] ?? '');
    if (!$taskId) json_error('taskId is required', 400);

    $stmt = $pdo->prepare("SELECT * FROM QACheck WHERE workItemId = ? ORDER BY id ASC");
    $stmt->execute([$taskId]);
    $checks = $stmt->fetchAll();

    $total = count($checks);
    $passed = 0;
    $needsFix = 0;
    $notApplicable = 0;
    $pending = 0;

    foreach ($checks as $c) {
        if ($c['status'] === 'Pass') $passed++;
        elseif ($c['status'] === 'Needs fix') $needsFix++;
        elseif ($c['status'] === 'Not applicable') $notApplicable++;
        else $pending++;
    }

    $isReadyForDelivery = ($needsFix === 0 && $pending === 0);

    json_response([
        'checks' => $checks,
        'summary' => [
            'total' => $total,
            'passed' => $passed,
            'needsFix' => $needsFix,
            'notApplicable' => $notApplicable,
            'pending' => $pending,
            'isReadyForDelivery' => $isReadyForDelivery
        ]
    ]);
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = get_json_input();

if ($action === 'update_item') {
    $checkId = $input['id'] ?? null;
    $status = $input['status'] ?? 'Pass';
    $notes = trim($input['notes'] ?? '');

    if (!$checkId) json_error('Check ID is required', 400);

    $upd = $pdo->prepare("
        UPDATE QACheck 
        SET status = ?, notes = ?, checkedBy = ?, checkedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
    ");
    $upd->execute([$status, $notes ?: null, $user['name'] ?: $user['email'], $checkId]);

    json_response(['success' => true]);
}

if ($action === 'record_delivery') {
    $taskId = $input['taskId'] ?? null;
    $format = $input['deliveryFormat'] ?? 'SCORM 1.2';
    $version = $input['packageVersion'] ?? '1.0.0';
    $destination = $input['destination'] ?? 'LMS Production';
    $handoffNotes = trim($input['handoffNotes'] ?? '');
    $qaOverrideReason = trim($input['qaOverrideReason'] ?? '');

    if (!$taskId) json_error('Deliverable ID is required', 400);

    $stmt = $pdo->prepare("SELECT id, humanId, title, projectId FROM WorkItem WHERE id = ?");
    $stmt->execute([$taskId]);
    $task = $stmt->fetch();
    if (!$task) json_error('Deliverable not found', 404);

    $deliveryId = generate_id();
    $ins = $pdo->prepare("
        INSERT INTO DeliveryRecord (id, workItemId, deliveryFormat, packageVersion, destination, handoffNotes, qaOverrideReason, deliveredBy, deliveryDate, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ");
    $ins->execute([
        $deliveryId,
        $taskId,
        $format,
        $version,
        $destination,
        $handoffNotes ?: null,
        $qaOverrideReason ?: null,
        $user['name'] ?: $user['email']
    ]);

    // Mark task as Delivered and Completed
    $pdo->prepare("
        UPDATE WorkItem 
        SET workflowStage = 'Delivered', status = 'Completed', progress = 100, deliveryDate = CURRENT_TIMESTAMP, deliveryLocation = ?, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
    ")->execute([$destination, $taskId]);

    log_activity(
        $pdo,
        'DELIVERED',
        "Package Delivered: {$task['humanId']}",
        "Shipped {$format} v{$version} to {$destination}",
        $taskId,
        $task['projectId']
    );

    json_response(['success' => true, 'deliveryId' => $deliveryId]);
}

json_error('Method not supported', 405);
