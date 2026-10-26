<?php
// ID Workbench v2 - Auth API
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/rate_limiter.php';
require_once __DIR__ . '/../lib/helpers.php';

$action = $_GET['action'] ?? $_POST['action'] ?? 'me';

if ($action === 'login') {
    enforce_rate_limit('login', 15, 60);
    $input = get_json_input();
    $email = trim($input['email'] ?? '');
    $password = (string)($input['password'] ?? '');

    if (!$email || !$password) {
        json_error('Email and password are required', 400);
    }

    $result = login_user($email, $password);
    if (!$result['success']) {
        json_error($result['error'], 401);
    }

    $pdo = get_db_connection();
    log_activity($pdo, 'LOGIN', 'User Logged In', "Session started for {$email}", null, null, null, null, null, $email);

    json_response($result);
}

if ($action === 'logout') {
    logout_user();
    json_response(['success' => true]);
}

if ($action === 'me') {
    $user = get_auth_user();
    $csrf = get_csrf_token();
    json_response([
        'authenticated' => (bool)$user,
        'user' => $user,
        'csrf_token' => $csrf
    ]);
}

if ($action === 'change_password') {
    $user = require_auth();
    $input = get_json_input();
    $current = (string)($input['current_password'] ?? '');
    $new = (string)($input['new_password'] ?? '');

    if (strlen($new) < 8) {
        json_error('New password must be at least 8 characters', 400);
    }

    $pdo = get_db_connection();
    $stmt = $pdo->prepare("SELECT passwordHash FROM User WHERE id = ?");
    $stmt->execute([$user['id']]);
    $currHash = $stmt->fetchColumn();

    if (!password_verify($current, $currHash)) {
        json_error('Current password is incorrect', 400);
    }

    $newHash = password_hash($new, PASSWORD_BCRYPT, ['cost' => 12]);
    $pdo->prepare("UPDATE User SET passwordHash = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?")->execute([$newHash, $user['id']]);

    json_response(['success' => true, 'message' => 'Password updated successfully']);
}

json_error('Invalid auth action', 400);
