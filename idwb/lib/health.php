<?php
// ID Workbench v2 - Health Calculator
declare(strict_types=1);

function parse_date_safe(mixed $val): ?DateTime {
    if (empty($val)) return null;
    if ($val instanceof DateTime) return $val;
    if (is_numeric($val)) {
        $num = (float)$val;
        $seconds = ($num > 10000000000) ? (int)($num / 1000) : (int)$num;
        $dt = new DateTime('@' . $seconds);
        $dt->setTimezone(new DateTimeZone('UTC'));
        return $dt;
    }
    try {
        return new DateTime((string)$val, new DateTimeZone('UTC'));
    } catch (Exception $e) {
        return null;
    }
}

function compute_task_health(array $task): array {
    $today = get_app_now();
    $today->setTime(0, 0, 0);
    
    $isCompletedOrCancelled =
        ($task['status'] ?? '') === 'Completed' ||
        ($task['status'] ?? '') === 'Cancelled' ||
        ($task['workflowStage'] ?? '') === 'Delivered' ||
        ($task['workflowStage'] ?? '') === 'Cancelled';

    if ($isCompletedOrCancelled) {
        return [
            'isOverdue' => false,
            'isDueSoon' => false,
            'isBlocked' => false,
            'isWaitingOnSME' => false,
            'isStale' => false,
            'isAtRisk' => false,
            'healthLevel' => 'HEALTHY',
            'healthBadge' => 'Completed',
            'reasons' => [],
        ];
    }

    $reasons = [];
    $dueDate = parse_date_safe($task['dueDate'] ?? null);
    $isOverdue = $dueDate ? ($dueDate < $today) : false;
    if ($isOverdue) {
        $reasons[] = 'Due date has passed';
    }

    $dueSoonLimit = (clone $today)->modify('+3 days');
    $isDueSoon = ($dueDate && !$isOverdue) ? ($dueDate < $dueSoonLimit) : false;
    if ($isDueSoon) {
        $reasons[] = 'Due within 3 days';
    }

    $isBlocked = !empty($task['isBlocked']);
    if ($isBlocked) {
        $blocker = !empty($task['blockerReason']) ? $task['blockerReason'] : 'Reason not specified';
        $reasons[] = "Blocked: {$blocker}";
    }

    $stage = $task['workflowStage'] ?? '';
    $status = $task['status'] ?? '';
    $isWaitingOnSME = (
        $stage === 'Awaiting SME Review' ||
        $stage === 'Clarification Required' ||
        $status === 'Waiting'
    );
    if ($isWaitingOnSME) {
        $reasons[] = 'Awaiting SME action/clarification';
    }

    $updatedAt = parse_date_safe($task['updatedAt'] ?? null) ?: $today;
    $daysSinceUpdate = (int)$today->diff($updatedAt)->format('%a');
    $isStale = ($daysSinceUpdate >= 5);
    if ($isStale) {
        $reasons[] = "No updates in {$daysSinceUpdate} days";
    }

    $isReviewOverdue = false;
    if (!empty($task['reviewRequestedDate']) && empty($task['feedbackReceivedDate'])) {
        $reqDate = parse_date_safe($task['reviewRequestedDate']);
        if ($reqDate && (int)$today->diff($reqDate)->format('%a') > 3) {
            $isReviewOverdue = true;
            $reasons[] = 'Review feedback is overdue (>3 days)';
        }
    }

    $isAtRisk = ($isOverdue || $isBlocked || $isReviewOverdue);

    $healthLevel = 'HEALTHY';
    $healthBadge = 'On Track';

    if ($isBlocked) {
        $healthLevel = 'CRITICAL';
        $healthBadge = 'Blocked';
    } elseif ($isOverdue) {
        $healthLevel = 'CRITICAL';
        $healthBadge = 'Overdue';
    } elseif ($isAtRisk || $isWaitingOnSME) {
        $healthLevel = 'ATTENTION';
        $healthBadge = $isWaitingOnSME ? 'Waiting on SME' : 'At Risk';
    } elseif ($isDueSoon) {
        $healthLevel = 'ATTENTION';
        $healthBadge = 'Due Soon';
    } elseif ($isStale) {
        $healthLevel = 'ATTENTION';
        $healthBadge = 'Stale';
    }

    return [
        'isOverdue' => $isOverdue,
        'isDueSoon' => $isDueSoon,
        'isBlocked' => $isBlocked,
        'isWaitingOnSME' => $isWaitingOnSME,
        'isStale' => $isStale,
        'isAtRisk' => $isAtRisk,
        'healthLevel' => $healthLevel,
        'healthBadge' => $healthBadge,
        'reasons' => $reasons,
    ];
}

function compute_project_health(array $project, array $workItems): array {
    $totalTasks = count($workItems);
    $completedTasks = 0;
    $activeTasks = [];

    foreach ($workItems as $t) {
        $status = $t['status'] ?? '';
        $stage = $t['workflowStage'] ?? '';
        if ($status === 'Completed' || $stage === 'Delivered') {
            $completedTasks++;
        } elseif ($status !== 'Cancelled' && $stage !== 'Cancelled') {
            $activeTasks[] = $t;
        }
    }

    $completionRate = $totalTasks > 0 ? (int)round(($completedTasks / $totalTasks) * 100) : 0;

    if (!empty($project['healthOverride'])) {
        return [
            'health' => $project['healthOverride'],
            'reason' => $project['healthOverrideReason'] ?: 'Manual override by instructional designer',
            'isOverridden' => true,
            'completionRate' => $completionRate,
        ];
    }

    $today = new DateTime('today', new DateTimeZone('UTC'));
    $blockedCount = 0;
    $overdueCount = 0;

    foreach ($activeTasks as $t) {
        if (!empty($t['isBlocked'])) {
            $blockedCount++;
        }
        $dueDate = parse_date_safe($t['dueDate'] ?? null);
        if ($dueDate && $dueDate < $today) {
            $overdueCount++;
        }
    }

    $isTargetPassed = false;
    $targetDate = parse_date_safe($project['targetDeliveryDate'] ?? null);
    if ($targetDate) {
        $isTargetPassed = ($targetDate < $today);
    }

    if ($blockedCount >= 2 || $overdueCount >= 2 || ($isTargetPassed && count($activeTasks) > 0)) {
        return [
            'health' => 'Critical',
            'reason' => $isTargetPassed
                ? 'Target delivery date passed with active tasks'
                : "{$blockedCount} blocked and {$overdueCount} overdue task(s)",
            'isOverridden' => false,
            'completionRate' => $completionRate,
        ];
    }

    if ($blockedCount > 0 || $overdueCount > 0) {
        return [
            'health' => 'At Risk',
            'reason' => "{$blockedCount} blocked and {$overdueCount} overdue task(s)",
            'isOverridden' => false,
            'completionRate' => $completionRate,
        ];
    }

    return [
        'health' => 'Healthy',
        'reason' => 'All tasks on schedule without blockers',
        'isOverridden' => false,
        'completionRate' => $completionRate,
    ];
}
