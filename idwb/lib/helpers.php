<?php
// ID Workbench v2 - Utility Helpers & Constants
declare(strict_types=1);

const WORKFLOW_STAGES = [
    "New SME Material Received",
    "Intake / Source Review",
    "Clarification Required",
    "Content Analysis",
    "Learning Design / Storyboarding",
    "Awaiting Internal Review",
    "Awaiting SME Review",
    "Revisions Required",
    "E-Learning Development",
    "QA / Functional Testing",
    "LMS / SCORM Preparation",
    "Ready for Delivery",
    "Delivered",
    "On Hold",
    "Cancelled",
];

const WORK_TYPES = [
    "Course", "Module", "Lesson", "Assessment", "Video",
    "Interaction", "Job Aid", "SOP", "Quiz", "Translation",
    "Accessibility Fix", "LMS Package", "Other"
];

const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

const TASK_STATUSES = [
    "Active", "In Progress", "Waiting", "Blocked", "Completed", "Cancelled"
];

const DEFAULT_QA_ITEMS = [
    [
        "checkKey" => "CONTENT_MATCH",
        "title" => "Content matches approved SME source",
        "category" => "Pedagogy & Content",
        "isRequired" => true
    ],
    [
        "checkKey" => "LEARNING_OBJECTIVES",
        "title" => "Learning objectives are clear and aligned with assessment",
        "category" => "Pedagogy & Content",
        "isRequired" => true
    ],
    [
        "checkKey" => "ASSESSMENT_VERIFIED",
        "title" => "Assessment answers, distractor rationales, and remedial feedback verified",
        "category" => "Pedagogy & Content",
        "isRequired" => true
    ],
    [
        "checkKey" => "NAVIGATION_INTERACTIONS",
        "title" => "Branching, menu progression, and interactive widgets tested",
        "category" => "Navigation & Media",
        "isRequired" => true
    ],
    [
        "checkKey" => "SPELLING_TERMINOLOGY",
        "title" => "Spelling, grammar, and specialized technical terminology checked",
        "category" => "Pedagogy & Content",
        "isRequired" => true
    ],
    [
        "checkKey" => "MEDIA_ASSETS",
        "title" => "Audio sync, high-res graphics, and video compression verified",
        "category" => "Navigation & Media",
        "isRequired" => true
    ],
    [
        "checkKey" => "CAPTIONS_TRANSCRIPTS",
        "title" => "Closed captions, transcripts, and alternative formats provided",
        "category" => "Accessibility",
        "isRequired" => true
    ],
    [
        "checkKey" => "A11Y_BASICS",
        "title" => "Accessibility: keyboard tabs, visible focus, screen reader tags, color contrast",
        "category" => "Accessibility",
        "isRequired" => true
    ],
    [
        "checkKey" => "RESPONSIVE_BEHAVIOR",
        "title" => "Mobile and tablet reflow tested across resolutions",
        "category" => "Navigation & Media",
        "isRequired" => true
    ],
    [
        "checkKey" => "SCORM_PACKAGE",
        "title" => "SCORM / xAPI manifest, passing score, and completion triggers validated",
        "category" => "LMS & SCORM",
        "isRequired" => true
    ],
    [
        "checkKey" => "LMS_LAUNCH",
        "title" => "LMS test launch: bookmarking, resume state, and gradebook passback verified",
        "category" => "LMS & SCORM",
        "isRequired" => true
    ],
    [
        "checkKey" => "FINAL_APPROVAL",
        "title" => "Final instructional design and stakeholder signoff recorded",
        "category" => "Approval",
        "isRequired" => true
    ]
];

function json_response(mixed $data, int $statusCode = 200): void {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $statusCode = 400): void {
    json_response(['error' => $message], $statusCode);
}

function get_json_input(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return $_POST;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function generate_id(): string {
    return 'cm' . bin2hex(random_bytes(10));
}

function log_activity(
    PDO $pdo,
    string $eventType,
    string $title,
    ?string $description = null,
    ?string $workItemId = null,
    ?string $projectId = null,
    ?string $previousStage = null,
    ?string $newStage = null,
    ?array $metadata = null,
    ?string $userEmail = null
): void {
    if (!$userEmail && !empty($_SESSION['user_email'])) {
        $userEmail = $_SESSION['user_email'];
    }
    if (!$userEmail) {
        $userEmail = 'system@workbench.internal';
    }

    $id = generate_id();
    $stmt = $pdo->prepare("
        INSERT INTO ActivityEvent (id, workItemId, projectId, eventType, previousStage, newStage, title, description, metadata, userEmail, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ");
    $stmt->execute([
        $id,
        $workItemId,
        $projectId,
        $eventType,
        $previousStage,
        $newStage,
        $title,
        $description,
        $metadata ? json_encode($metadata) : null,
        $userEmail
    ]);
}

function get_app_now(): DateTime {
    $frozen = $_SERVER['HTTP_X_FROZEN_TIME'] ?? $_SERVER['HTTP_X_CLIENT_TIME'] ?? $_COOKIE['app_frozen_time'] ?? getenv('APP_FROZEN_TIME') ?? null;
    if ($frozen) {
        try {
            return new DateTime($frozen, new DateTimeZone('UTC'));
        } catch (Exception $e) {}
    }
    return new DateTime('now', new DateTimeZone('UTC'));
}

