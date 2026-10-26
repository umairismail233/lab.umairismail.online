<?php
// ID Workbench v2 - Authentication & Session Management
declare(strict_types=1);

require_once __DIR__ . '/database.php';

function start_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        $cookieParams = [
            'lifetime' => 86400 * 7, // 7 days
            'path'     => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443)
        ];
        session_set_cookie_params($cookieParams);
        session_name('idw_session');
        session_start();
    }
}

function get_auth_user(): ?array {
    start_session();
    if (empty($_SESSION['user_id'])) {
        return null;
    }

    $pdo = get_db_connection();
    $stmt = $pdo->prepare("SELECT id, email, name, role FROM User WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        unset($_SESSION['user_id']);
        return null;
    }

    return $user;
}

function require_auth(): array {
    $user = get_auth_user();
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'error' => 'Unauthorized: Valid session required',
            'redirect' => 'login.html'
        ]);
        exit;
    }
    return $user;
}

function login_user(string $email, string $password): array {
    start_session();
    $pdo = get_db_connection();

    $cleanEmail = trim(strtolower($email));
    $stmt = $pdo->prepare("SELECT id, email, passwordHash, name, role FROM User WHERE LOWER(email) = ?");
    $stmt->execute([$cleanEmail]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['passwordHash'])) {
        return ['success' => false, 'error' => 'Invalid email or password'];
    }

    // Regenerate session id on login to prevent fixation
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['user_role'] = $user['role'];

    // Generate CSRF token
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

    return [
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'email' => $user['email'],
            'name' => $user['name'],
            'role' => $user['role'],
        ],
        'csrf_token' => $_SESSION['csrf_token']
    ];
}

function logout_user(): void {
    start_session();
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
}

function get_csrf_token(): string {
    start_session();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function validate_csrf_token(?string $token): bool {
    start_session();
    if (empty($_SESSION['csrf_token']) || empty($token)) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}
