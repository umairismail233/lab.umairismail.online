<?php
// ID Workbench v2 - Main Entry Point with Server-Side Session Gate
declare(strict_types=1);

// Prevent browser bfcache from caching protected portal content
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/config/auth.php';

$user = get_auth_user();
if (!$user) {
    header('Location: login.html', true, 302);
    exit;
}

// User is authenticated: serve the portal application
readfile(__DIR__ . '/index.html');
exit;
