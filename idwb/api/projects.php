<?php
// ID Workbench v2 - Projects & Courses API
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/health.php';

$user = require_auth();
$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;

    if ($id) {
        $stmt = $pdo->prepare("SELECT * FROM Project WHERE id = ? OR code = ?");
        $stmt->execute([$id, $id]);
        $project = $stmt->fetch();
        if (!$project) json_error('Project not found', 404);

        // Fetch Work Items
        $taskStmt = $pdo->prepare("SELECT * FROM WorkItem WHERE projectId = ? AND isArchived = 0 ORDER BY itemNumber ASC");
        $taskStmt->execute([$project['id']]);
        $workItems = $taskStmt->fetchAll();

        foreach ($workItems as &$t) {
            $t['health'] = compute_task_health($t);
        }
        unset($t);

        // Fetch Milestones
        $mStmt = $pdo->prepare("SELECT * FROM ProjectMilestone WHERE projectId = ? ORDER BY targetDate ASC");
        $mStmt->execute([$project['id']]);
        $milestones = $mStmt->fetchAll();

        // Project Health
        $project['healthInfo'] = compute_project_health($project, $workItems);
        $project['workItems'] = $workItems;
        $project['milestones'] = $milestones;

        json_response($project);
    }

    // List all projects
    $projects = $pdo->query("SELECT * FROM Project WHERE isArchived = 0 ORDER BY updatedAt DESC")->fetchAll();

    foreach ($projects as &$p) {
        $taskStmt = $pdo->prepare("SELECT * FROM WorkItem WHERE projectId = ? AND isArchived = 0");
        $taskStmt->execute([$p['id']]);
        $items = $taskStmt->fetchAll();

        $p['healthInfo'] = compute_project_health($p, $items);
        $p['totalTasks'] = count($items);
        $p['completedTasks'] = count(array_filter($items, fn($i) => $i['status'] === 'Completed' || $i['workflowStage'] === 'Delivered'));
    }
    unset($p);

    json_response($projects);
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = get_json_input();

if ($action === 'toggle_milestone') {
    $milestoneId = $input['id'] ?? null;
    $isCompleted = !empty($input['isCompleted']) ? 1 : 0;

    $stmt = $pdo->prepare("
        UPDATE ProjectMilestone 
        SET isCompleted = ?, completedDate = ?, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
    ");
    $stmt->execute([$isCompleted, $isCompleted ? date('Y-m-d H:i:s') : null, $milestoneId]);

    json_response(['success' => true]);
}

if ($method === 'POST') {
    $isUpdate = !empty($input['id']);
    $name = trim($input['name'] ?? '');
    $code = trim($input['code'] ?? '');

    if (!$name) json_error('Project name is required', 400);

    if ($isUpdate) {
        $upd = $pdo->prepare("
            UPDATE Project SET
                name = :name,
                description = :description,
                clientDepartment = :clientDepartment,
                courseCode = :courseCode,
                startDate = :startDate,
                targetDeliveryDate = :targetDeliveryDate,
                status = :status,
                smeName = :smeName,
                smeEmail = :smeEmail,
                healthOverride = :healthOverride,
                healthOverrideReason = :healthOverrideReason,
                notes = :notes,
                updatedAt = CURRENT_TIMESTAMP
            WHERE id = :id
        ");
        $upd->execute([
            ':name' => $name,
            ':description' => $input['description'] ?? null,
            ':clientDepartment' => $input['clientDepartment'] ?? null,
            ':courseCode' => $input['courseCode'] ?? null,
            ':startDate' => !empty($input['startDate']) ? $input['startDate'] : null,
            ':targetDeliveryDate' => !empty($input['targetDeliveryDate']) ? $input['targetDeliveryDate'] : null,
            ':status' => $input['status'] ?? 'Active',
            ':smeName' => $input['smeName'] ?? null,
            ':smeEmail' => $input['smeEmail'] ?? null,
            ':healthOverride' => $input['healthOverride'] ?? null,
            ':healthOverrideReason' => $input['healthOverrideReason'] ?? null,
            ':notes' => $input['notes'] ?? null,
            ':id' => $input['id'],
        ]);

        json_response(['success' => true, 'id' => $input['id']]);
    } else {
        if (!$code) {
            $count = (int)$pdo->query("SELECT COUNT(*) FROM Project")->fetchColumn() + 1;
            $code = sprintf("PRJ-%03d", $count);
        }

        $newId = generate_id();
        $ins = $pdo->prepare("
            INSERT INTO Project (
                id, code, name, description, clientDepartment, courseCode,
                startDate, targetDeliveryDate, status, smeName, smeEmail, notes,
                createdAt, updatedAt
            ) VALUES (
                :id, :code, :name, :description, :clientDepartment, :courseCode,
                :startDate, :targetDeliveryDate, :status, :smeName, :smeEmail, :notes,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
        ");
        $ins->execute([
            ':id' => $newId,
            ':code' => $code,
            ':name' => $name,
            ':description' => $input['description'] ?? null,
            ':clientDepartment' => $input['clientDepartment'] ?? null,
            ':courseCode' => $input['courseCode'] ?? null,
            ':startDate' => !empty($input['startDate']) ? $input['startDate'] : null,
            ':targetDeliveryDate' => !empty($input['targetDeliveryDate']) ? $input['targetDeliveryDate'] : null,
            ':status' => $input['status'] ?? 'Active',
            ':smeName' => $input['smeName'] ?? null,
            ':smeEmail' => $input['smeEmail'] ?? null,
            ':notes' => $input['notes'] ?? null,
        ]);

        json_response(['success' => true, 'id' => $newId, 'code' => $code], 201);
    }
}

json_error('Method not supported', 405);
