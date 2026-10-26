<?php
// ID Workbench v2 - Reports & Analytics API
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/health.php';

$user = require_auth();
$pdo = get_db_connection();

// 1. Overall stats
$totalTasks = (int)$pdo->query("SELECT COUNT(*) FROM WorkItem WHERE isArchived = 0")->fetchColumn();
$deliveredTasks = (int)$pdo->query("SELECT COUNT(*) FROM WorkItem WHERE workflowStage = 'Delivered' AND isArchived = 0")->fetchColumn();
$inProgressTasks = (int)$pdo->query("SELECT COUNT(*) FROM WorkItem WHERE status = 'In Progress' AND isArchived = 0")->fetchColumn();
$blockedTasks = (int)$pdo->query("SELECT COUNT(*) FROM WorkItem WHERE isBlocked = 1 AND isArchived = 0")->fetchColumn();

// 2. Deliverables by workType
$byTypeStmt = $pdo->query("
    SELECT workType, COUNT(*) as count 
    FROM WorkItem 
    WHERE isArchived = 0 
    GROUP BY workType 
    ORDER BY count DESC
");
$byWorkType = $byTypeStmt->fetchAll();

// 3. Deliverables by workflowStage
$byStageStmt = $pdo->query("
    SELECT workflowStage, COUNT(*) as count 
    FROM WorkItem 
    WHERE isArchived = 0 
    GROUP BY workflowStage
");
$rawStages = $byStageStmt->fetchAll(PDO::FETCH_KEY_PAIR);
$stageDistribution = [];
foreach (WORKFLOW_STAGES as $stage) {
    $stageDistribution[] = [
        'stage' => $stage,
        'count' => $rawStages[$stage] ?? 0
    ];
}

// 4. Bottleneck Analysis: Tasks stalled > 5 days or blocked
$bottlenecksStmt = $pdo->query("
    SELECT w.id, w.humanId, w.title, w.workflowStage, w.isBlocked, w.blockerReason, w.updatedAt, p.name as projectName
    FROM WorkItem w
    JOIN Project p ON w.projectId = p.id
    WHERE w.isArchived = 0 AND w.status NOT IN ('Completed', 'Cancelled')
    ORDER BY w.updatedAt ASC
    LIMIT 10
");
$bottlenecks = [];
$today = new DateTime('today', new DateTimeZone('UTC'));
foreach ($bottlenecksStmt->fetchAll() as $b) {
    $updated = parse_date_safe($b['updatedAt'] ?? null) ?: $today;
    $days = (int)$today->diff($updated)->format('%a');
    if ($days >= 3 || $b['isBlocked']) {
        $b['daysInactive'] = $days;
        $bottlenecks[] = $b;
    }
}

// 5. Review metrics
$totalReviews = (int)$pdo->query("SELECT COUNT(*) FROM Review")->fetchColumn();
$approvedReviews = (int)$pdo->query("SELECT COUNT(*) FROM Review WHERE outcome IN ('Approved', 'Approved with minor changes')")->fetchColumn();
$revisionRounds = (int)$pdo->query("SELECT COUNT(*) FROM RevisionRound")->fetchColumn();

json_response([
    'overview' => [
        'totalTasks' => $totalTasks,
        'deliveredTasks' => $deliveredTasks,
        'inProgressTasks' => $inProgressTasks,
        'blockedTasks' => $blockedTasks,
        'completionRate' => $totalTasks > 0 ? (int)round(($deliveredTasks / $totalTasks) * 100) : 0,
        'totalReviews' => $totalReviews,
        'approvedReviews' => $approvedReviews,
        'revisionRounds' => $revisionRounds,
    ],
    'stageDistribution' => $stageDistribution,
    'byWorkType' => $byWorkType,
    'bottlenecks' => $bottlenecks,
]);
