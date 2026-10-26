<?php
// ID Workbench v2 - System Settings & Integrations API
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/seed_data.php';

$user = require_auth();
$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Get integration settings
    $settings = $pdo->query("SELECT * FROM IntegrationSetting WHERE id = 'global'")->fetch();
    if (!$settings) {
        $pdo->exec("INSERT OR IGNORE INTO IntegrationSetting (id) VALUES ('global')");
        $settings = $pdo->query("SELECT * FROM IntegrationSetting WHERE id = 'global'")->fetch();
    }

    // Mask secret
    if (!empty($settings['zoomClientSecret'])) {
        $settings['zoomClientSecret'] = '••••••••••••••••';
    }

    // Team members / users
    $users = $pdo->query("SELECT id, email, name, role, createdAt FROM User ORDER BY name ASC")->fetchAll();

    // Check if demo data present
    $demoCount = (int)$pdo->query("SELECT COUNT(*) FROM WorkItem WHERE isDemo = 1")->fetchColumn();

    json_response([
        'integrations' => $settings,
        'users' => $users,
        'hasDemoData' => ($demoCount > 0),
        'server' => [
            'php_version' => PHP_VERSION,
            'sqlite_version' => $pdo->query("SELECT sqlite_version()")->fetchColumn(),
            'platform' => PHP_OS,
        ]
    ]);
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = get_json_input();

if ($action === 'load_demo_data' || $action === 'seed_demo') {
    $anchor = null;
    $rawAnchor = $input['anchorDate'] ?? $input['anchor'] ?? $_GET['anchorDate'] ?? $_GET['anchor'] ?? null;
    if ($rawAnchor) {
        try {
            $anchor = new DateTime((string)$rawAnchor, new DateTimeZone('UTC'));
        } catch (Exception $e) {}
    }
    seed_demo_data($pdo, $anchor);
    json_response(['success' => true, 'message' => 'Demo data loaded successfully']);
}

if ($action === 'purge_demo_data' || $action === 'purge_demo') {
    purge_demo_data($pdo);
    json_response(['success' => true, 'message' => 'Demo data purged cleanly']);
}

if ($action === 'save_integrations') {
    $upd = $pdo->prepare("
        UPDATE IntegrationSetting SET
            teamsWebhookUrl = :teamsWebhookUrl,
            teamsEnabled = :teamsEnabled,
            notifySmeReview = :notifySmeReview,
            notifyBlocked = :notifyBlocked,
            notifyDelivered = :notifyDelivered,
            notifyNewIntake = :notifyNewIntake,
            zoomDefaultPmi = :zoomDefaultPmi,
            zoomPasscode = :zoomPasscode,
            zoomAccountId = :zoomAccountId,
            zoomClientId = :zoomClientId,
            zoomApiEnabled = :zoomApiEnabled,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = 'global'
    ");
    $upd->execute([
        ':teamsWebhookUrl' => $input['teamsWebhookUrl'] ?? null,
        ':teamsEnabled' => !empty($input['teamsEnabled']) ? 1 : 0,
        ':notifySmeReview' => !empty($input['notifySmeReview']) ? 1 : 0,
        ':notifyBlocked' => !empty($input['notifyBlocked']) ? 1 : 0,
        ':notifyDelivered' => !empty($input['notifyDelivered']) ? 1 : 0,
        ':notifyNewIntake' => !empty($input['notifyNewIntake']) ? 1 : 0,
        ':zoomDefaultPmi' => $input['zoomDefaultPmi'] ?? null,
        ':zoomPasscode' => $input['zoomPasscode'] ?? 'idw123',
        ':zoomAccountId' => $input['zoomAccountId'] ?? null,
        ':zoomClientId' => $input['zoomClientId'] ?? null,
        ':zoomApiEnabled' => !empty($input['zoomApiEnabled']) ? 1 : 0,
    ]);

    json_response(['success' => true, 'message' => 'Integration settings saved']);
}

if ($action === 'create_user') {
    if ($user['role'] !== 'SUPER_ADMIN' && $user['role'] !== 'ADMIN') {
        json_error('Admin privileges required to create accounts', 403);
    }

    $email = trim(strtolower($input['email'] ?? ''));
    $name = trim($input['name'] ?? '');
    $password = (string)($input['password'] ?? '');
    $role = $input['role'] ?? 'INSTRUCTIONAL_DESIGNER';

    if (!$email || !$name || strlen($password) < 8) {
        json_error('Email, name, and password (min 8 chars) are required', 400);
    }

    $chk = $pdo->prepare("SELECT id FROM User WHERE email = ?");
    $chk->execute([$email]);
    if ($chk->fetch()) {
        json_error('A user with this email already exists', 400);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $newUserId = generate_id();

    $ins = $pdo->prepare("
        INSERT INTO User (id, email, passwordHash, name, role, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ");
    $ins->execute([$newUserId, $email, $hash, $name, $role]);

    json_response(['success' => true, 'id' => $newUserId, 'email' => $email]);
}

if ($action === 'change_password') {
    $currentPassword = (string)($input['currentPassword'] ?? '');
    $newPassword = (string)($input['newPassword'] ?? '');

    if (strlen($newPassword) < 8) {
        json_error('New password must be at least 8 characters long', 400);
    }

    $stmt = $pdo->prepare("SELECT passwordHash FROM User WHERE id = ?");
    $stmt->execute([$user['id']]);
    $currentHash = $stmt->fetchColumn();

    if (!$currentHash || !password_verify($currentPassword, $currentHash)) {
        json_error('Current password is incorrect', 400);
    }

    $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
    $upd = $pdo->prepare("UPDATE User SET passwordHash = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?");
    $upd->execute([$newHash, $user['id']]);

    json_response(['success' => true, 'message' => 'Password changed successfully']);
}

json_error('Method not supported', 405);
