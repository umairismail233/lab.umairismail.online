<?php
// ID Workbench v2 - Database Connection
declare(strict_types=1);

function get_db_connection(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dbDir = __DIR__ . '/../database';
    if (!is_dir($dbDir)) {
        mkdir($dbDir, 0755, true);
    }

    $dbPath = getenv('DATABASE_PATH') ?: ($dbDir . '/idw.db');

    $isNew = !file_exists($dbPath) || filesize($dbPath) === 0;

    $dsn = 'sqlite:' . $dbPath;
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, null, null, $options);
    $pdo->exec('PRAGMA foreign_keys = ON;');
    $pdo->exec('PRAGMA journal_mode = WAL;');

    if ($isNew) {
        initialize_database($pdo);
    } else {
        run_migrations($pdo);
    }

    return $pdo;
}

function run_migrations(PDO $pdo): void {
    try { $pdo->exec("ALTER TABLE Review ADD COLUMN humanId TEXT"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE Review ADD COLUMN title TEXT"); } catch (Exception $e) {}
}

function initialize_database(PDO $pdo): void {
    // Create tables matching schema
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS User (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            passwordHash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT DEFAULT 'INSTRUCTIONAL_DESIGNER',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS Project (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            clientDepartment TEXT,
            courseCode TEXT,
            startDate DATETIME,
            targetDeliveryDate DATETIME,
            status TEXT DEFAULT 'Active',
            smeName TEXT,
            smeEmail TEXT,
            healthOverride TEXT,
            healthOverrideReason TEXT,
            notes TEXT,
            isArchived INTEGER DEFAULT 0,
            isDemo INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ProjectMilestone (
            id TEXT PRIMARY KEY,
            projectId TEXT NOT NULL,
            title TEXT NOT NULL,
            targetDate DATETIME NOT NULL,
            completedDate DATETIME,
            isCompleted INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS SMEIntake (
            id TEXT PRIMARY KEY,
            intakeNumber INTEGER UNIQUE NOT NULL,
            humanId TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            senderName TEXT NOT NULL,
            senderEmail TEXT,
            receivedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
            projectId TEXT,
            courseModuleName TEXT,
            materialType TEXT DEFAULT 'Word',
            version TEXT DEFAULT '1.0',
            sourceSummary TEXT,
            expectedOutput TEXT,
            dueDate DATETIME,
            completeness TEXT DEFAULT 'Partial',
            missingItems TEXT,
            clarificationNotes TEXT,
            followUpDate DATETIME,
            responseReceivedDate DATETIME,
            status TEXT DEFAULT 'New',
            sourceFileRef TEXT,
            notes TEXT,
            zoomMeetingUrl TEXT,
            zoomMeetingTime DATETIME,
            isConverted INTEGER DEFAULT 0,
            convertedTaskId TEXT,
            isArchived INTEGER DEFAULT 0,
            isDemo INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS WorkItem (
            id TEXT PRIMARY KEY,
            itemNumber INTEGER UNIQUE NOT NULL,
            humanId TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            projectId TEXT NOT NULL,
            moduleLesson TEXT,
            workType TEXT DEFAULT 'Module',
            priority TEXT DEFAULT 'Normal',
            workflowStage TEXT DEFAULT 'New SME Material Received',
            status TEXT DEFAULT 'Active',
            assignedOwner TEXT DEFAULT 'lead@workbench.internal',
            tags TEXT DEFAULT '[]',
            smeIntakeId TEXT,
            smeName TEXT,
            smeContact TEXT,
            sourceMaterialType TEXT,
            sourceFileName TEXT,
            sourceFileUrl TEXT,
            sourceReceivedDate DATETIME,
            sourceVersion TEXT,
            sourceSummary TEXT,
            learningObjectivesProvided TEXT DEFAULT 'Not checked',
            completeness TEXT DEFAULT 'Not checked',
            missingInfo TEXT,
            clarificationQuestions TEXT,
            smeResponseDueDate DATETIME,
            clarificationRequestedDate DATETIME,
            responseReceivedDate DATETIME,
            sourceNotes TEXT,
            plannedStartDate DATETIME,
            dueDate DATETIME,
            estimatedHours REAL,
            actualHours REAL,
            progress INTEGER DEFAULT 0,
            nextAction TEXT,
            isBlocked INTEGER DEFAULT 0,
            blockerReason TEXT,
            internalReviewer TEXT,
            smeReviewer TEXT,
            reviewRequestedDate DATETIME,
            feedbackReceivedDate DATETIME,
            revisionRoundCount INTEGER DEFAULT 0,
            revisionNotes TEXT,
            lmsTarget TEXT,
            scormRequirement TEXT,
            deliveryDate DATETIME,
            deliveryLocation TEXT,
            finalNotes TEXT,
            isArchived INTEGER DEFAULT 0,
            isDemo INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE,
            FOREIGN KEY (smeIntakeId) REFERENCES SMEIntake(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS SourceVersion (
            id TEXT PRIMARY KEY,
            workItemId TEXT,
            smeIntakeId TEXT,
            versionNumber TEXT NOT NULL,
            fileName TEXT NOT NULL,
            fileUrl TEXT,
            changeNotes TEXT,
            uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (workItemId) REFERENCES WorkItem(id) ON DELETE CASCADE,
            FOREIGN KEY (smeIntakeId) REFERENCES SMEIntake(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS Review (
            id TEXT PRIMARY KEY,
            workItemId TEXT NOT NULL,
            humanId TEXT,
            title TEXT,
            reviewType TEXT NOT NULL,
            reviewerName TEXT NOT NULL,
            reviewerEmail TEXT,
            requestedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
            expectedResponseDate DATETIME,
            feedbackReceivedDate DATETIME,
            outcome TEXT DEFAULT 'Pending',
            feedbackSummary TEXT,
            changesRequired TEXT,
            resolutionNotes TEXT,
            isResolved INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (workItemId) REFERENCES WorkItem(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS RevisionRound (
            id TEXT PRIMARY KEY,
            workItemId TEXT NOT NULL,
            reviewId TEXT,
            roundNumber INTEGER NOT NULL,
            feedbackSummary TEXT NOT NULL,
            changesRequired TEXT NOT NULL,
            owner TEXT NOT NULL,
            resolution TEXT,
            isResolved INTEGER DEFAULT 0,
            resolvedAt DATETIME,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (workItemId) REFERENCES WorkItem(id) ON DELETE CASCADE,
            FOREIGN KEY (reviewId) REFERENCES Review(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS QACheck (
            id TEXT PRIMARY KEY,
            workItemId TEXT NOT NULL,
            checkKey TEXT NOT NULL,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT DEFAULT 'Not started',
            isRequired INTEGER DEFAULT 1,
            notes TEXT,
            checkedAt DATETIME,
            checkedBy TEXT,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(workItemId, checkKey),
            FOREIGN KEY (workItemId) REFERENCES WorkItem(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS DeliveryRecord (
            id TEXT PRIMARY KEY,
            workItemId TEXT NOT NULL,
            deliveryFormat TEXT NOT NULL,
            packageVersion TEXT NOT NULL,
            destination TEXT NOT NULL,
            deliveryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
            handoffNotes TEXT,
            qaOverrideReason TEXT,
            deliveredBy TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (workItemId) REFERENCES WorkItem(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ActivityEvent (
            id TEXT PRIMARY KEY,
            workItemId TEXT,
            projectId TEXT,
            eventType TEXT NOT NULL,
            previousStage TEXT,
            newStage TEXT,
            title TEXT NOT NULL,
            description TEXT,
            metadata TEXT,
            userEmail TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (workItemId) REFERENCES WorkItem(id) ON DELETE CASCADE,
            FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS TaskDependency (
            id TEXT PRIMARY KEY,
            predecessorId TEXT NOT NULL,
            successorId TEXT NOT NULL,
            dependencyType TEXT DEFAULT 'Finish-to-Start',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(predecessorId, successorId),
            FOREIGN KEY (predecessorId) REFERENCES WorkItem(id) ON DELETE CASCADE,
            FOREIGN KEY (successorId) REFERENCES WorkItem(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS Category (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            color TEXT DEFAULT 'indigo',
            isDefault INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS IntegrationSetting (
            id TEXT PRIMARY KEY DEFAULT 'global',
            teamsWebhookUrl TEXT,
            teamsEnabled INTEGER DEFAULT 0,
            notifySmeReview INTEGER DEFAULT 1,
            notifyBlocked INTEGER DEFAULT 1,
            notifyDelivered INTEGER DEFAULT 0,
            notifyNewIntake INTEGER DEFAULT 1,
            zoomDefaultPmi TEXT,
            zoomPasscode TEXT DEFAULT 'idw123',
            zoomAccountId TEXT,
            zoomClientId TEXT,
            zoomClientSecret TEXT,
            zoomApiEnabled INTEGER DEFAULT 0,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    try { $pdo->exec("ALTER TABLE Review ADD COLUMN humanId TEXT"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE Review ADD COLUMN title TEXT"); } catch (Exception $e) {}

    // Initialize Default Categories
    $categories = [
        'Course', 'Module', 'Lesson', 'Assessment', 'Video',
        'Interaction', 'Job Aid', 'SOP', 'Quiz', 'Translation',
        'Accessibility Fix', 'LMS Package', 'Other'
    ];
    $catStmt = $pdo->prepare("INSERT OR IGNORE INTO Category (id, name, description, isDefault) VALUES (?, ?, ?, 1)");
    foreach ($categories as $cat) {
        $catStmt->execute([bin2hex(random_bytes(10)), $cat, "Instructional design category: {$cat}"]);
    }

    // Initialize IntegrationSetting
    $pdo->exec("INSERT OR IGNORE INTO IntegrationSetting (id) VALUES ('global')");

    // Create initial Super Admin and Lead Admin if no users
    $userCount = (int)$pdo->query("SELECT COUNT(*) FROM User")->fetchColumn();
    if ($userCount === 0) {
        $superHash = password_hash('Workbench#2026!Admin', PASSWORD_BCRYPT, ['cost' => 12]);
        $pdo->prepare("
            INSERT INTO User (id, email, passwordHash, name, role)
            VALUES (?, 'admin@workbench.local', ?, 'Super Administrator', 'SUPER_ADMIN')
        ")->execute([bin2hex(random_bytes(10)), $superHash]);

        $leadHash = password_hash('Workbench#2026!Lead', PASSWORD_BCRYPT, ['cost' => 12]);
        $pdo->prepare("
            INSERT INTO User (id, email, passwordHash, name, role)
            VALUES (?, 'lead@workbench.local', ?, 'Operations Lead', 'ADMIN')
        ")->execute([bin2hex(random_bytes(10)), $leadHash]);
    }
}
