<?php
// ID Workbench v2 - Dashboard Overview API
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/health.php';

$user = require_auth();
$pdo = get_db_connection();

// 1. Projects
$projectsStmt = $pdo->query("SELECT id, name, code, status, targetDeliveryDate FROM Project WHERE isArchived = 0 ORDER BY name ASC");
$projects = $projectsStmt->fetchAll();

// 2. Active Projects Count
$activeProjectsCount = (int)$pdo->query("SELECT COUNT(*) FROM Project WHERE status = 'Active' AND isArchived = 0")->fetchColumn();

// 3. Work Items (active and recent)
$tasksStmt = $pdo->query("
    SELECT w.*, p.name as projectName, p.code as projectCode
    FROM WorkItem w
    JOIN Project p ON w.projectId = p.id
    WHERE w.isArchived = 0
    ORDER BY w.updatedAt DESC
");
$allTasks = $tasksStmt->fetchAll();

// 4. Categories
$categories = $pdo->query("SELECT name FROM Category ORDER BY name ASC")->fetchAll(PDO::FETCH_COLUMN);

// 5. SME Inbox Count
$inboxCount = (int)$pdo->query("
    SELECT COUNT(*) FROM SMEIntake 
    WHERE isArchived = 0 AND status NOT IN ('Converted', 'Archived')
")->fetchColumn();

// 6. Demo Tasks Count
$demoCount = (int)$pdo->query("SELECT COUNT(*) FROM WorkItem WHERE isDemo = 1")->fetchColumn();

// Compute KPIs & Health
$now = get_app_now();
$today = (clone $now)->setTime(0, 0, 0);
$tomorrow = (clone $today)->modify('+1 day');
$fourteenDaysLater = (clone $today)->modify('+14 days');

$tasksDueToday = 0;
$overdueTasks = 0;
$waitingOnSme = 0;
$blockedTasks = 0;
$readyForQa = 0;
$completedThisWeek = 0;
$attentionCount = 0;
$weekAgo = (clone $today)->modify('-7 days')->format('Y-m-d H:i:s');

$todayFocusTasks = [];
$needsAttentionTasks = [];
$upcomingDeadlineTasks = [];

$stageCounts = array_fill_keys(WORKFLOW_STAGES, 0);

foreach ($allTasks as &$task) {
    $stage = $task['workflowStage'];
    if (isset($stageCounts[$stage])) {
        $stageCounts[$stage]++;
    }

    $health = compute_task_health($task);
    $task['health'] = $health;

    $isCompleted = ($task['status'] === 'Completed' || $task['status'] === 'Cancelled' || $stage === 'Delivered' || $stage === 'Cancelled');

    if ($isCompleted) {
        $updatedAt = $task['updatedAt'] ?? '';
        if ($updatedAt >= $weekAgo) {
            $completedThisWeek++;
        }
        continue;
    }

    if ($health['isAtRisk'] || $health['isBlocked'] || $health['isOverdue'] || $health['isWaitingOnSME']) {
        $attentionCount++;
        $needsAttentionTasks[] = $task;
    }

    if ($health['isBlocked']) {
        $blockedTasks++;
    }
    if ($health['isOverdue']) {
        $overdueTasks++;
    }
    if ($health['isWaitingOnSME']) {
        $waitingOnSme++;
    }

    $dueDate = parse_date_safe($task['dueDate'] ?? null);
    if ($dueDate && $dueDate >= $today && $dueDate < $tomorrow) {
        $tasksDueToday++;
        $todayFocusTasks[] = $task;
    } elseif (($task['priority'] ?? '') === 'Urgent' || ($task['priority'] ?? '') === 'High') {
        $todayFocusTasks[] = $task;
    }

    if ($dueDate && $dueDate >= $tomorrow && $dueDate <= $fourteenDaysLater) {
        $upcomingDeadlineTasks[] = $task;
    }

        if ($stage === 'QA / Functional Testing' || $stage === 'Ready for Delivery') {
            $readyForQa++;
        }
}
unset($task);

// 7. Recent SME Intakes
$recentIntakesStmt = $pdo->query("
    SELECT s.*, p.code as projectCode, p.name as projectName
    FROM SMEIntake s
    LEFT JOIN Project p ON s.projectId = p.id
    WHERE s.isArchived = 0
    ORDER BY s.receivedDate DESC, s.intakeNumber DESC
    LIMIT 5
");
$recentIntakes = $recentIntakesStmt->fetchAll();

// 8. Recent Activity Events
$recentActivityStmt = $pdo->query("
    SELECT a.*, w.humanId, w.title as workItemTitle, p.code as projectCode, p.name as projectName
    FROM ActivityEvent a
    LEFT JOIN WorkItem w ON a.workItemId = w.id
    LEFT JOIN Project p ON a.projectId = p.id
    ORDER BY a.createdAt DESC
    LIMIT 10
");
$recentActivity = $recentActivityStmt->fetchAll();

json_response([
    'user' => $user,
    'projects' => $projects,
    'categories' => $categories,
    'attentionCount' => $attentionCount,
    'inboxCount' => $inboxCount,
    'hasDemoData' => ($demoCount > 0),
    'kpis' => [
        'activeProjects' => $activeProjectsCount,
        'tasksDueToday' => $tasksDueToday,
        'overdueTasks' => $overdueTasks,
        'waitingOnSme' => $waitingOnSme,
        'waitingOnSME' => $waitingOnSme,
        'blockedTasks' => $blockedTasks,
        'completedThisWeek' => $completedThisWeek,
        'readyForQa' => $readyForQa,
    ],
    'stageCounts' => $stageCounts,
    'todayFocusTasks' => array_slice($todayFocusTasks, 0, 6),
    'needsAttentionTasks' => array_slice($needsAttentionTasks, 0, 6),
    'upcomingDeadlineTasks' => array_slice($upcomingDeadlineTasks, 0, 6),
    'recentIntakes' => $recentIntakes,
    'recentActivity' => $recentActivity,
]);
