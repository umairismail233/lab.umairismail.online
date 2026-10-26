<?php
// ID Workbench v2 - CSV Data Export API
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../lib/helpers.php';

$user = require_auth();
$pdo = get_db_connection();

$type = $_GET['type'] ?? 'tasks';
$filename = "idw_{$type}_export_" . date('Ymd_His') . ".csv";

header('Content-Type: text/csv; charset=utf-8');
header("Content-Disposition: attachment; filename=\"{$filename}\"");
header('Pragma: no-cache');
header('Expires: 0');

$output = fopen('php://output', 'w');
// Output BOM for Excel UTF-8 support
fputs($output, "\xEF\xBB\xBF");

if ($type === 'sme') {
    fputcsv($output, [
        'Intake ID', 'Title', 'Sender Name', 'Sender Email', 'Course / Module',
        'Material Type', 'Version', 'Status', 'Completeness', 'Received Date', 'Due Date'
    ]);

    $stmt = $pdo->query("
        SELECT humanId, title, senderName, senderEmail, courseModuleName, materialType, version, status, completeness, receivedDate, dueDate
        FROM SMEIntake
        WHERE isArchived = 0
        ORDER BY receivedDate DESC
    ");
    while ($row = $stmt->fetch()) {
        fputcsv($output, $row);
    }
} else {
    // Deliverables / Tasks Export
    fputcsv($output, [
        'Human ID', 'Title', 'Project Code', 'Project Name', 'Work Type',
        'Workflow Stage', 'Status', 'Priority', 'Assigned Owner', 'Progress (%)',
        'Due Date', 'Blocked', 'Blocker Reason', 'SME Name', 'Delivery Date'
    ]);

    $stmt = $pdo->query("
        SELECT w.humanId, w.title, p.code, p.name, w.workType,
               w.workflowStage, w.status, w.priority, w.assignedOwner, w.progress,
               w.dueDate, (CASE WHEN w.isBlocked = 1 THEN 'Yes' ELSE 'No' END), w.blockerReason, w.smeName, w.deliveryDate
        FROM WorkItem w
        JOIN Project p ON w.projectId = p.id
        WHERE w.isArchived = 0
        ORDER BY w.itemNumber ASC
    ");
    while ($row = $stmt->fetch()) {
        fputcsv($output, $row);
    }
}

fclose($output);
exit;
