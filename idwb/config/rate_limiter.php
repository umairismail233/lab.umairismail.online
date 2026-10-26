<?php
// ID Workbench v2 - IP Rate Limiter
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

function check_rate_limit(string $action = 'general', int $maxRequests = 120, int $windowSeconds = 60): bool {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    
    start_session();

    $now = time();
    $key = "rl_{$action}_{$ip}";

    if (!isset($_SESSION[$key]) || !is_array($_SESSION[$key])) {
        $_SESSION[$key] = [
            'count' => 1,
            'start' => $now
        ];
        return true;
    }

    $data = &$_SESSION[$key];

    if ($now - $data['start'] > $windowSeconds) {
        $data['count'] = 1;
        $data['start'] = $now;
        return true;
    }

    $data['count']++;

    if ($data['count'] > $maxRequests) {
        return false;
    }

    return true;
}

function enforce_rate_limit(string $action = 'general', int $maxRequests = 120, int $windowSeconds = 60): void {
    if (!check_rate_limit($action, $maxRequests, $windowSeconds)) {
        http_response_code(429);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'Too Many Requests: Rate limit exceeded. Please wait a moment.',
            'retry_after' => $windowSeconds
        ]);
        exit;
    }
}
