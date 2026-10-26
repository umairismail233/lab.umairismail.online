<?php
// ID Workbench v2 - Calendar API
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/health.php';

$user = require_auth();
$pdo = get_db_connection();

$events = [];

// Deliverable due dates
$taskStmt = $pdo->query("
    SELECT w.id, w.humanId, w.title, w.dueDate, w.workflowStage, w.priority, w.status, w.isBlocked, w.assignedOwner, p.name as projectName, p.code as projectCode
    FROM WorkItem w
    JOIN Project p ON w.projectId = p.id
    WHERE w.dueDate IS NOT NULL AND w.isArchived = 0
");
$tasks = $taskStmt->fetchAll();
foreach ($tasks as $t) {
    $d = parse_date_safe($t['dueDate']);
    if (!$d) continue;
    $events[] = [
        'id' => $t['id'],
        'title' => "{$t['humanId']}: {$t['title']}",
        'date' => $d->format('Y-m-d'),
        'type' => 'task',
        'stage' => $t['workflowStage'],
        'priority' => $t['priority'],
        'status' => $t['status'],
        'isBlocked' => (bool)$t['isBlocked'],
        'project' => $t['projectCode']
    ];
}

// Project Milestones
$mStmt = $pdo->query("
    SELECT m.id, m.title, m.targetDate, m.isCompleted, p.name as projectName, p.code as projectCode
    FROM ProjectMilestone m
    JOIN Project p ON m.projectId = p.id
    WHERE m.targetDate IS NOT NULL AND p.isArchived = 0
");
$milestones = $mStmt->fetchAll();
foreach ($milestones as $m) {
    $d = parse_date_safe($m['targetDate']);
    if (!$d) continue;
    $events[] = [
        'id' => $m['id'],
        'title' => "[Milestone] {$m['title']} ({$m['projectCode']})",
        'date' => $d->format('Y-m-d'),
        'type' => 'milestone',
        'isCompleted' => (bool)$m['isCompleted'],
        'project' => $m['projectCode']
    ];
}

json_response($events);
