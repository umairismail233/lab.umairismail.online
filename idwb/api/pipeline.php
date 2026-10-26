<?php
// ID Workbench v2 - 15-Stage Pipeline API
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/health.php';

$user = require_auth();
$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $projectId = trim($_GET['projectId'] ?? '');
    
    $sql = "
        SELECT w.*, p.name as projectName, p.code as projectCode
        FROM WorkItem w
        JOIN Project p ON w.projectId = p.id
        WHERE w.isArchived = 0
    ";
    $params = [];
    if ($projectId !== '') {
        $sql .= " AND w.projectId = ?";
        $params[] = $projectId;
    }
    $sql .= " ORDER BY w.priority DESC, w.updatedAt DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $allTasks = $stmt->fetchAll();

    // Group tasks into the 15 stages
    $pipeline = [];
    foreach (WORKFLOW_STAGES as $stageName) {
        $pipeline[$stageName] = [
            'stage' => $stageName,
            'count' => 0,
            'tasks' => []
        ];
    }

    foreach ($allTasks as &$task) {
        $task['health'] = compute_task_health($task);
        $task['tags'] = json_decode($task['tags'] ?: '[]', true);
        $stage = $task['workflowStage'];

        if (isset($pipeline[$stage])) {
            $pipeline[$stage]['tasks'][] = $task;
            $pipeline[$stage]['count']++;
        }
    }
    unset($task);

    json_response([
        'stages' => WORKFLOW_STAGES,
        'pipeline' => array_values($pipeline),
        'totalTasks' => count($allTasks)
    ]);
}

if ($method === 'POST') {
    $input = get_json_input();
    $taskId = $input['taskId'] ?? null;
    $targetStage = $input['targetStage'] ?? null;

    if (!$taskId || !$targetStage || !in_array($targetStage, WORKFLOW_STAGES, true)) {
        json_error('Valid taskId and targetStage required', 400);
    }

    $stmt = $pdo->prepare("SELECT id, title, projectId, workflowStage, status FROM WorkItem WHERE id = ?");
    $stmt->execute([$taskId]);
    $curr = $stmt->fetch();
    if (!$curr) json_error('Task not found', 404);

    $prevStage = $curr['workflowStage'];
    $newStatus = $curr['status'];
    if ($targetStage === 'Delivered') {
        $newStatus = 'Completed';
    } elseif ($curr['status'] === 'Completed' && $targetStage !== 'Delivered') {
        $newStatus = 'In Progress';
    }

    $upd = $pdo->prepare("UPDATE WorkItem SET workflowStage = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?");
    $upd->execute([$targetStage, $newStatus, $taskId]);

    log_activity(
        $pdo,
        'STAGE_CHANGED',
        "Stage transitioned to {$targetStage}",
        "Moved deliverable from {$prevStage} to {$targetStage}",
        $taskId,
        $curr['projectId'],
        $prevStage,
        $targetStage
    );

    json_response([
        'success' => true,
        'taskId' => $taskId,
        'previousStage' => $prevStage,
        'newStage' => $targetStage,
        'status' => $newStatus
    ]);
}

json_error('Method not supported', 405);
