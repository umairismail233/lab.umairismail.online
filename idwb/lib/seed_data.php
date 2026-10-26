<?php
// ID Workbench v2 - Authoritative Demo Data Seed & Purge
// Computes all date fields relative to load time, replicating D:\Setup\ID-Tracker\src\lib\demo-data.ts
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function purge_demo_data(PDO $pdo): void {
    $pdo->beginTransaction();
    try {
        $pdo->exec("
            DELETE FROM ActivityEvent;
            DELETE FROM DeliveryRecord WHERE workItemId IN (SELECT id FROM WorkItem WHERE isDemo = 1);
            DELETE FROM QACheck WHERE workItemId IN (SELECT id FROM WorkItem WHERE isDemo = 1);
            DELETE FROM RevisionRound WHERE workItemId IN (SELECT id FROM WorkItem WHERE isDemo = 1);
            DELETE FROM Review WHERE workItemId IN (SELECT id FROM WorkItem WHERE isDemo = 1);
            DELETE FROM SourceVersion WHERE workItemId IN (SELECT id FROM WorkItem WHERE isDemo = 1) OR smeIntakeId IN (SELECT id FROM SMEIntake WHERE isDemo = 1);
            DELETE FROM TaskDependency WHERE predecessorId IN (SELECT id FROM WorkItem WHERE isDemo = 1) OR successorId IN (SELECT id FROM WorkItem WHERE isDemo = 1);
            DELETE FROM WorkItem WHERE isDemo = 1;
            DELETE FROM SMEIntake WHERE isDemo = 1;
            DELETE FROM ProjectMilestone WHERE projectId IN (SELECT id FROM Project WHERE isDemo = 1);
            DELETE FROM Project WHERE isDemo = 1;
        ");
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function seed_demo_data(PDO $pdo, ?DateTime $anchor = null): void {
    purge_demo_data($pdo);

    if ($anchor === null) {
        $anchor = get_app_now();
    }

    // Helper: compute relative date string with preserved time of day
    $rel = function(int $offsetDays) use ($anchor): string {
        $dt = (clone $anchor)->modify(($offsetDays >= 0 ? "+{$offsetDays}" : "{$offsetDays}") . " days");
        return $dt->format('Y-m-d H:i:s');
    };

    $nowStr = $anchor->format('Y-m-d H:i:s');

    $pdo->beginTransaction();
    try {
        // Table: Project (2 records)
        // Project 1: startDate = now - 14d, targetDeliveryDate = now + 10d
        $p1Start = $rel(-14);
        $p1Target = $rel(10);
        $pdo->exec("INSERT INTO `Project` (`id`, `code`, `name`, `description`, `clientDepartment`, `courseCode`, `startDate`, `targetDeliveryDate`, `status`, `smeName`, `smeEmail`, `healthOverride`, `healthOverrideReason`, `notes`, `isArchived`, `isDemo`, `createdAt`, `updatedAt`) VALUES ('cmv9a4kk30000v6mwl42ibhie', 'DEMO-SEC-101', '[DEMO] Cybersecurity Awareness & Phishing Defense 2026', 'Interactive corporate compliance module for 1,500 employees covering spear phishing, credential stuffing, and incident reporting.', 'Enterprise Information Security', 'SEC-101', '{$p1Start}', '{$p1Target}', 'Active', 'Dr. Marcus Vance', 'm.vance@cyberdemo.org', NULL, NULL, NULL, 0, 1, '{$nowStr}', '{$nowStr}')");

        // Project 2: startDate = now - 7d, targetDeliveryDate = now + 21d
        $p2Start = $rel(-7);
        $p2Target = $rel(21);
        $pdo->exec("INSERT INTO `Project` (`id`, `code`, `name`, `description`, `clientDepartment`, `courseCode`, `startDate`, `targetDeliveryDate`, `status`, `smeName`, `smeEmail`, `healthOverride`, `healthOverrideReason`, `notes`, `isArchived`, `isDemo`, `createdAt`, `updatedAt`) VALUES ('cmv9a4kki0004v6mwmvurwfkk', 'DEMO-MED-204', '[DEMO] Clinical Trial Good Laboratory Practice (GLP)', 'Accredited e-learning series on biospecimen chain-of-custody and FDA 21 CFR Part 11 audit trails.', 'Biomedical Compliance', 'MED-204', '{$p2Start}', '{$p2Target}', 'Active', 'Elena Rostova', 'elena.rostova@biomeddemo.com', NULL, NULL, NULL, 0, 1, '{$nowStr}', '{$nowStr}')");

        // Table: ProjectMilestone (3 records)
        // Milestone 1: Storyboards Approved, targetDate = now - 5d, completedDate = now - 5d
        $m1Date = $rel(-5);
        $pdo->exec("INSERT INTO `ProjectMilestone` (`id`, `projectId`, `title`, `targetDate`, `completedDate`, `isCompleted`, `createdAt`, `updatedAt`) VALUES ('cmv9a4kk50001v6mwlbssosqd', 'cmv9a4kk30000v6mwl42ibhie', 'Storyboards Approved', '{$m1Date}', '{$m1Date}', 1, '{$nowStr}', '{$nowStr}')");

        // Milestone 2: Alpha Build Internal Review, targetDate = now + 2d
        $m2Date = $rel(2);
        $pdo->exec("INSERT INTO `ProjectMilestone` (`id`, `projectId`, `title`, `targetDate`, `completedDate`, `isCompleted`, `createdAt`, `updatedAt`) VALUES ('cmv9a4kk50002v6mwx1v30gws', 'cmv9a4kk30000v6mwl42ibhie', 'Alpha Build Internal Review', '{$m2Date}', NULL, 0, '{$nowStr}', '{$nowStr}')");

        // Milestone 3: LMS SCORM Deployment, targetDate = now + 10d
        $m3Date = $rel(10);
        $pdo->exec("INSERT INTO `ProjectMilestone` (`id`, `projectId`, `title`, `targetDate`, `completedDate`, `isCompleted`, `createdAt`, `updatedAt`) VALUES ('cmv9a4kk50003v6mwh12pze2u', 'cmv9a4kk30000v6mwl42ibhie', 'LMS SCORM Deployment', '{$m3Date}', NULL, 0, '{$nowStr}', '{$nowStr}')");

        // Table: SMEIntake (2 records)
        // Intake 1: dueDate = now + 5d
        $int1Due = $rel(5);
        $pdo->exec("INSERT INTO `SMEIntake` (`id`, `intakeNumber`, `humanId`, `title`, `senderName`, `senderEmail`, `receivedDate`, `projectId`, `courseModuleName`, `materialType`, `version`, `sourceSummary`, `expectedOutput`, `dueDate`, `completeness`, `missingItems`, `clarificationNotes`, `followUpDate`, `responseReceivedDate`, `status`, `sourceFileRef`, `notes`, `isConverted`, `convertedTaskId`, `isArchived`, `isDemo`, `createdAt`, `updatedAt`, `zoomMeetingTime`, `zoomMeetingUrl`) VALUES ('cmv9a4kkn0006v6mw742xhhle', 9001, 'INT-9001', 'Raw PPT & Case Studies on Ransomware Escalation', 'Dr. Marcus Vance', 'm.vance@cyberdemo.org', '{$nowStr}', 'cmv9a4kk30000v6mwl42ibhie', 'Module 2: Real-World Scenarios', 'PowerPoint', 'v1.2', 'Contains 45 slides detailing recent zero-day phishing vector case studies and incident reporting flowcharts.', '15-minute interactive Rise scenario with branching decisions', '{$int1Due}', 'Partial', 'Missing rubrics for quiz scoring and audio voiceover script timings.', 'Sent email requesting clarification on Slide 28 incident response escalation chart.', NULL, NULL, 'Clarification Requested', NULL, NULL, 1, NULL, 0, 1, '{$nowStr}', '{$nowStr}', NULL, NULL)");

        // Intake 2: dueDate = now + 14d
        $int2Due = $rel(14);
        $pdo->exec("INSERT INTO `SMEIntake` (`id`, `intakeNumber`, `humanId`, `title`, `senderName`, `senderEmail`, `receivedDate`, `projectId`, `courseModuleName`, `materialType`, `version`, `sourceSummary`, `expectedOutput`, `dueDate`, `completeness`, `missingItems`, `clarificationNotes`, `followUpDate`, `responseReceivedDate`, `status`, `sourceFileRef`, `notes`, `isConverted`, `convertedTaskId`, `isArchived`, `isDemo`, `createdAt`, `updatedAt`, `zoomMeetingTime`, `zoomMeetingUrl`) VALUES ('cmv9a4kkt0008v6mwbwjwkjgl', 9002, 'INT-9002', 'Specimen Chain-of-Custody Standard Operating Procedure', 'Elena Rostova', 'elena.rostova@biomeddemo.com', '{$nowStr}', 'cmv9a4kki0004v6mwmvurwfkk', 'GLP Unit 3', 'Word', 'v2.0-final', '32-page SOP Word document with regulatory reference tables.', 'Interactive Storyline 360 module with drag-and-drop compliance checklist.', '{$int2Due}', 'Complete', NULL, NULL, NULL, NULL, 'New', NULL, NULL, 0, NULL, 0, 1, '{$nowStr}', '{$nowStr}', NULL, NULL)");

        // Table: WorkItem (4 records)
        // Task 1 (IDW-9001): plannedStartDate = now - 8d, dueDate = now (Due today!), sourceReceivedDate = now - 12d
        $t1Start = $rel(-8);
        $t1SourceRecv = $rel(-12);
        $pdo->exec("INSERT INTO `WorkItem` (`id`, `itemNumber`, `humanId`, `title`, `description`, `projectId`, `moduleLesson`, `workType`, `priority`, `workflowStage`, `status`, `assignedOwner`, `tags`, `smeIntakeId`, `smeName`, `smeContact`, `sourceMaterialType`, `sourceFileName`, `sourceFileUrl`, `sourceReceivedDate`, `sourceVersion`, `sourceSummary`, `learningObjectivesProvided`, `completeness`, `missingInfo`, `clarificationQuestions`, `smeResponseDueDate`, `clarificationRequestedDate`, `responseReceivedDate`, `sourceNotes`, `plannedStartDate`, `dueDate`, `estimatedHours`, `actualHours`, `progress`, `nextAction`, `isBlocked`, `blockerReason`, `internalReviewer`, `smeReviewer`, `reviewRequestedDate`, `feedbackReceivedDate`, `revisionRoundCount`, `revisionNotes`, `lmsTarget`, `scormRequirement`, `deliveryDate`, `deliveryLocation`, `finalNotes`, `isArchived`, `isDemo`, `createdAt`, `updatedAt`) VALUES ('cmv9a4kl5000av6mwemhf1pi6', 9001, 'IDW-9001', 'Module 1: Phishing Vectors & Red Flags', NULL, 'cmv9a4kk30000v6mwl42ibhie', 'Module 1', 'Module', 'High', 'E-Learning Development', 'Active', 'Abeera@wb.com', '[]', 'cmv9a4kkn0006v6mw742xhhle', 'Dr. Marcus Vance', NULL, 'PowerPoint', 'Phishing_2026_Master_Deck.pptx', NULL, '{$t1SourceRecv}', NULL, NULL, 'Yes', 'Complete', NULL, NULL, NULL, NULL, NULL, NULL, '{$t1Start}', '{$nowStr}', 18.0, 12.5, 65, 'Complete branching scenario 3 in Storyline and test audio triggers', 0, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1, '{$nowStr}', '{$nowStr}')");

        // Task 2 (IDW-9002): dueDate = now + 3d, clarificationRequestedDate = now - 4d, smeResponseDueDate = now - 1d
        $t2Due = $rel(3);
        $t2ClarReq = $rel(-4);
        $t2SmeRespDue = $rel(-1);
        $pdo->exec("INSERT INTO `WorkItem` (`id`, `itemNumber`, `humanId`, `title`, `description`, `projectId`, `moduleLesson`, `workType`, `priority`, `workflowStage`, `status`, `assignedOwner`, `tags`, `smeIntakeId`, `smeName`, `smeContact`, `sourceMaterialType`, `sourceFileName`, `sourceFileUrl`, `sourceReceivedDate`, `sourceVersion`, `sourceSummary`, `learningObjectivesProvided`, `completeness`, `missingInfo`, `clarificationQuestions`, `smeResponseDueDate`, `clarificationRequestedDate`, `responseReceivedDate`, `sourceNotes`, `plannedStartDate`, `dueDate`, `estimatedHours`, `actualHours`, `progress`, `nextAction`, `isBlocked`, `blockerReason`, `internalReviewer`, `smeReviewer`, `reviewRequestedDate`, `feedbackReceivedDate`, `revisionRoundCount`, `revisionNotes`, `lmsTarget`, `scormRequirement`, `deliveryDate`, `deliveryLocation`, `finalNotes`, `isArchived`, `isDemo`, `createdAt`, `updatedAt`) VALUES ('cmv9a4klh000pv6mw0a17b190', 9002, 'IDW-9002', 'Interactive Ransomware Simulation Lab', NULL, 'cmv9a4kk30000v6mwl42ibhie', 'Module 2', 'Interaction', 'Urgent', 'Clarification Required', 'Blocked', 'Abeera@wb.com', '[]', NULL, 'Dr. Marcus Vance', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Not checked', 'Not checked', NULL, NULL, '{$t2SmeRespDue}', '{$t2ClarReq}', NULL, NULL, NULL, '{$t2Due}', 12.0, NULL, 25, 'Ping Dr. Vance for legal team response regarding Slide 28 mockups', 1, 'Awaiting legal counsel clarification on realistic company email screenshot disclosures.', NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1, '{$nowStr}', '{$nowStr}')");

        // Task 3 (IDW-9003): dueDate = now + 6d, reviewRequestedDate = now - 2d
        $t3Due = $rel(6);
        $t3RevReq = $rel(-2);
        $pdo->exec("INSERT INTO `WorkItem` (`id`, `itemNumber`, `humanId`, `title`, `description`, `projectId`, `moduleLesson`, `workType`, `priority`, `workflowStage`, `status`, `assignedOwner`, `tags`, `smeIntakeId`, `smeName`, `smeContact`, `sourceMaterialType`, `sourceFileName`, `sourceFileUrl`, `sourceReceivedDate`, `sourceVersion`, `sourceSummary`, `learningObjectivesProvided`, `completeness`, `missingInfo`, `clarificationQuestions`, `smeResponseDueDate`, `clarificationRequestedDate`, `responseReceivedDate`, `sourceNotes`, `plannedStartDate`, `dueDate`, `estimatedHours`, `actualHours`, `progress`, `nextAction`, `isBlocked`, `blockerReason`, `internalReviewer`, `smeReviewer`, `reviewRequestedDate`, `feedbackReceivedDate`, `revisionRoundCount`, `revisionNotes`, `lmsTarget`, `scormRequirement`, `deliveryDate`, `deliveryLocation`, `finalNotes`, `isArchived`, `isDemo`, `createdAt`, `updatedAt`) VALUES ('cmv9a4klq0013v6mwhpl4cvcz', 9003, 'IDW-9003', 'Course Assessment & Remedial Feedback Bank', NULL, 'cmv9a4kk30000v6mwl42ibhie', 'Final Quiz', 'Assessment', 'Normal', 'Awaiting SME Review', 'Waiting', 'Abeera@wb.com', '[]', NULL, 'Dr. Marcus Vance', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Not checked', 'Not checked', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{$t3Due}', 8.0, NULL, 80, 'Review SME feedback on question 14 scoring rubric', 0, NULL, NULL, 'Dr. Marcus Vance', '{$t3RevReq}', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1, '{$nowStr}', '{$nowStr}')");

        // Task 4 (IDW-9004): plannedStartDate = now - 10d, dueDate = now - 3d, deliveryDate = now - 2d
        $t4Start = $rel(-10);
        $t4Due = $rel(-3);
        $t4Delivery = $rel(-2);
        $pdo->exec("INSERT INTO `WorkItem` (`id`, `itemNumber`, `humanId`, `title`, `description`, `projectId`, `moduleLesson`, `workType`, `priority`, `workflowStage`, `status`, `assignedOwner`, `tags`, `smeIntakeId`, `smeName`, `smeContact`, `sourceMaterialType`, `sourceFileName`, `sourceFileUrl`, `sourceReceivedDate`, `sourceVersion`, `sourceSummary`, `learningObjectivesProvided`, `completeness`, `missingInfo`, `clarificationQuestions`, `smeResponseDueDate`, `clarificationRequestedDate`, `responseReceivedDate`, `sourceNotes`, `plannedStartDate`, `dueDate`, `estimatedHours`, `actualHours`, `progress`, `nextAction`, `isBlocked`, `blockerReason`, `internalReviewer`, `smeReviewer`, `reviewRequestedDate`, `feedbackReceivedDate`, `revisionRoundCount`, `revisionNotes`, `lmsTarget`, `scormRequirement`, `deliveryDate`, `deliveryLocation`, `finalNotes`, `isArchived`, `isDemo`, `createdAt`, `updatedAt`) VALUES ('cmv9a4km1001iv6mw1j89343v', 9004, 'IDW-9004', 'Cyber Hygiene Quick-Reference Job Aid (PDF)', NULL, 'cmv9a4kk30000v6mwl42ibhie', 'Reference Appendix', 'Job Aid', 'Low', 'Delivered', 'Completed', 'Abeera@wb.com', '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Not checked', 'Not checked', NULL, NULL, NULL, NULL, NULL, NULL, '{$t4Start}', '{$t4Due}', 4.0, 3.5, 100, NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, NULL, 'PDF / Job Aid', NULL, '{$t4Delivery}', 'https://intranet.company.internal/learning/security-job-aid-2026.pdf', NULL, 0, 1, '{$nowStr}', '{$nowStr}')");

        // Table: Review (1 records)
        // requestedDate = now - 2d, expectedResponseDate = now + 2d
        $revReq = $rel(-2);
        $revExp = $rel(2);
        $pdo->exec("INSERT INTO `Review` (`id`, `workItemId`, `reviewType`, `reviewerName`, `reviewerEmail`, `requestedDate`, `expectedResponseDate`, `feedbackReceivedDate`, `outcome`, `feedbackSummary`, `changesRequired`, `resolutionNotes`, `isResolved`, `createdAt`, `updatedAt`, `humanId`, `title`) VALUES ('cmv9a4klq0014v6mwddnsxvte', 'cmv9a4klq0013v6mwhpl4cvcz', 'SME', 'Dr. Marcus Vance', 'm.vance@cyberdemo.org', '{$revReq}', '{$revExp}', NULL, 'Pending', 'Draft assessment submitted for clinical terminology and distractor validation.', NULL, NULL, 0, '{$nowStr}', '{$nowStr}', 'IDW-9003', 'Course Assessment & Remedial Feedback Bank')");

        // Table: QACheck (48 records)
        // Task 1: first 4 pass with checkedAt = now
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4kl5000bv6mwvgg0at2n', 'cmv9a4kl5000av6mwemhf1pi6', 'CONTENT_MATCH', 'Content matches approved SME source', 'Pedagogy & Content', 'Pass', 1, 'Verified against Slide 12-30', '{$nowStr}', NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4kl5000cv6mw4cttw1vj', 'cmv9a4kl5000av6mwemhf1pi6', 'LEARNING_OBJECTIVES', 'Learning objectives are clear and aligned with assessment', 'Pedagogy & Content', 'Pass', 1, NULL, '{$nowStr}', NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4kl5000dv6mw2856853p', 'cmv9a4kl5000av6mwemhf1pi6', 'ASSESSMENT_VERIFIED', 'Assessment answers, distractor rationales, and remedial feedback verified', 'Pedagogy & Content', 'Pass', 1, NULL, '{$nowStr}', NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4kl5000ev6mw7pgztj60', 'cmv9a4kl5000av6mwemhf1pi6', 'NAVIGATION_INTERACTIONS', 'Branching, menu progression, and interactive widgets tested', 'Navigation & Media', 'Pass', 1, NULL, '{$nowStr}', NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4kl5000fv6mwiqlk1jls', 'cmv9a4kl5000av6mwemhf1pi6', 'SPELLING_TERMINOLOGY', 'Spelling, grammar, and specialized technical terminology checked', 'Pedagogy & Content', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4kl5000gv6mw0txqjpp4', 'cmv9a4kl5000av6mwemhf1pi6', 'MEDIA_ASSETS', 'Audio sync, high-res graphics, and video compression verified', 'Navigation & Media', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4kl5000hv6mwy73a75cn', 'cmv9a4kl5000av6mwemhf1pi6', 'CAPTIONS_TRANSCRIPTS', 'Closed captions, transcripts, and alternative formats provided', 'Accessibility', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4kl5000iv6mwawq0oabd', 'cmv9a4kl5000av6mwemhf1pi6', 'A11Y_BASICS', 'Accessibility: keyboard tabs, visible focus, screen reader tags, color contrast', 'Accessibility', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4kl5000jv6mwzbb8k6n3', 'cmv9a4kl5000av6mwemhf1pi6', 'RESPONSIVE_BEHAVIOR', 'Mobile and tablet reflow tested across resolutions', 'Navigation & Media', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4kl5000kv6mwn39c7rrw', 'cmv9a4kl5000av6mwemhf1pi6', 'SCORM_PACKAGE', 'SCORM / xAPI manifest, passing score, and completion triggers validated', 'LMS & SCORM', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4kl6000lv6mwb2flvuc4', 'cmv9a4kl5000av6mwemhf1pi6', 'LMS_LAUNCH', 'LMS test launch: bookmarking, resume state, and gradebook passback verified', 'LMS & SCORM', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4kl6000mv6mw58amns2x', 'cmv9a4kl5000av6mwemhf1pi6', 'FINAL_APPROVAL', 'Final instructional design and stakeholder signoff recorded', 'Approval', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");

        // Task 2: all Not started
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klh000qv6mww4kmboec', 'cmv9a4klh000pv6mw0a17b190', 'CONTENT_MATCH', 'Content matches approved SME source', 'Pedagogy & Content', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klh000rv6mwmnow2jcl', 'cmv9a4klh000pv6mw0a17b190', 'LEARNING_OBJECTIVES', 'Learning objectives are clear and aligned with assessment', 'Pedagogy & Content', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klh000sv6mwxhhz7r5b', 'cmv9a4klh000pv6mw0a17b190', 'ASSESSMENT_VERIFIED', 'Assessment answers, distractor rationales, and remedial feedback verified', 'Pedagogy & Content', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klh000tv6mwqxkbwyty', 'cmv9a4klh000pv6mw0a17b190', 'NAVIGATION_INTERACTIONS', 'Branching, menu progression, and interactive widgets tested', 'Navigation & Media', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klh000uv6mwp64r51jn', 'cmv9a4klh000pv6mw0a17b190', 'SPELLING_TERMINOLOGY', 'Spelling, grammar, and specialized technical terminology checked', 'Pedagogy & Content', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klh000vv6mwz3c8e1o5', 'cmv9a4klh000pv6mw0a17b190', 'MEDIA_ASSETS', 'Audio sync, high-res graphics, and video compression verified', 'Navigation & Media', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klh000wv6mwkcq9htwy', 'cmv9a4klh000pv6mw0a17b190', 'CAPTIONS_TRANSCRIPTS', 'Closed captions, transcripts, and alternative formats provided', 'Accessibility', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klh000xv6mwrsdajtni', 'cmv9a4klh000pv6mw0a17b190', 'A11Y_BASICS', 'Accessibility: keyboard tabs, visible focus, screen reader tags, color contrast', 'Accessibility', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klh000yv6mwej1qrpwc', 'cmv9a4klh000pv6mw0a17b190', 'RESPONSIVE_BEHAVIOR', 'Mobile and tablet reflow tested across resolutions', 'Navigation & Media', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klh000zv6mw1v0vmzgj', 'cmv9a4klh000pv6mw0a17b190', 'SCORM_PACKAGE', 'SCORM / xAPI manifest, passing score, and completion triggers validated', 'LMS & SCORM', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klh0010v6mwxzww21yd', 'cmv9a4klh000pv6mw0a17b190', 'LMS_LAUNCH', 'LMS test launch: bookmarking, resume state, and gradebook passback verified', 'LMS & SCORM', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klh0011v6mwcqwijrm6', 'cmv9a4klh000pv6mw0a17b190', 'FINAL_APPROVAL', 'Final instructional design and stakeholder signoff recorded', 'Approval', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");

        // Task 3: all Not started
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klq0015v6mwsx8l26ck', 'cmv9a4klq0013v6mwhpl4cvcz', 'CONTENT_MATCH', 'Content matches approved SME source', 'Pedagogy & Content', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klq0016v6mwp4k2etvu', 'cmv9a4klq0013v6mwhpl4cvcz', 'LEARNING_OBJECTIVES', 'Learning objectives are clear and aligned with assessment', 'Pedagogy & Content', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klq0017v6mwlqychwxt', 'cmv9a4klq0013v6mwhpl4cvcz', 'ASSESSMENT_VERIFIED', 'Assessment answers, distractor rationales, and remedial feedback verified', 'Pedagogy & Content', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klq0018v6mwx4o1vcme', 'cmv9a4klq0013v6mwhpl4cvcz', 'NAVIGATION_INTERACTIONS', 'Branching, menu progression, and interactive widgets tested', 'Navigation & Media', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klq0019v6mwqd6p0hxg', 'cmv9a4klq0013v6mwhpl4cvcz', 'SPELLING_TERMINOLOGY', 'Spelling, grammar, and specialized technical terminology checked', 'Pedagogy & Content', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klq001av6mw78epxou6', 'cmv9a4klq0013v6mwhpl4cvcz', 'MEDIA_ASSETS', 'Audio sync, high-res graphics, and video compression verified', 'Navigation & Media', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klq001bv6mw4jhuees4', 'cmv9a4klq0013v6mwhpl4cvcz', 'CAPTIONS_TRANSCRIPTS', 'Closed captions, transcripts, and alternative formats provided', 'Accessibility', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klr001cv6mwr8wm8pi0', 'cmv9a4klq0013v6mwhpl4cvcz', 'A11Y_BASICS', 'Accessibility: keyboard tabs, visible focus, screen reader tags, color contrast', 'Accessibility', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klr001dv6mw36pxk8og', 'cmv9a4klq0013v6mwhpl4cvcz', 'RESPONSIVE_BEHAVIOR', 'Mobile and tablet reflow tested across resolutions', 'Navigation & Media', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klr001ev6mw7va67cjh', 'cmv9a4klq0013v6mwhpl4cvcz', 'SCORM_PACKAGE', 'SCORM / xAPI manifest, passing score, and completion triggers validated', 'LMS & SCORM', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klr001fv6mwt98zs5tb', 'cmv9a4klq0013v6mwhpl4cvcz', 'LMS_LAUNCH', 'LMS test launch: bookmarking, resume state, and gradebook passback verified', 'LMS & SCORM', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4klr001gv6mwxrx02it7', 'cmv9a4klq0013v6mwhpl4cvcz', 'FINAL_APPROVAL', 'Final instructional design and stakeholder signoff recorded', 'Approval', 'Not started', 1, NULL, NULL, NULL, '{$nowStr}')");

        // Task 4: all Pass with checkedAt = now - 2d
        $t4QaChecked = $rel(-2);
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4km1001jv6mwajf5rmh3', 'cmv9a4km1001iv6mw1j89343v', 'CONTENT_MATCH', 'Content matches approved SME source', 'Pedagogy & Content', 'Pass', 1, NULL, '{$t4QaChecked}', 'Abeera', '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4km1001kv6mw8ek4no69', 'cmv9a4km1001iv6mw1j89343v', 'LEARNING_OBJECTIVES', 'Learning objectives are clear and aligned with assessment', 'Pedagogy & Content', 'Pass', 1, NULL, '{$t4QaChecked}', 'Abeera', '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4km1001lv6mwwij6b61q', 'cmv9a4km1001iv6mw1j89343v', 'ASSESSMENT_VERIFIED', 'Assessment answers, distractor rationales, and remedial feedback verified', 'Pedagogy & Content', 'Pass', 1, NULL, '{$t4QaChecked}', 'Abeera', '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4km1001mv6mwn1f1qr9b', 'cmv9a4km1001iv6mw1j89343v', 'NAVIGATION_INTERACTIONS', 'Branching, menu progression, and interactive widgets tested', 'Navigation & Media', 'Pass', 1, NULL, '{$t4QaChecked}', 'Abeera', '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4km1001nv6mwoumpw4ua', 'cmv9a4km1001iv6mw1j89343v', 'SPELLING_TERMINOLOGY', 'Spelling, grammar, and specialized technical terminology checked', 'Pedagogy & Content', 'Pass', 1, NULL, '{$t4QaChecked}', 'Abeera', '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4km1001ov6mw17llbb6o', 'cmv9a4km1001iv6mw1j89343v', 'MEDIA_ASSETS', 'Audio sync, high-res graphics, and video compression verified', 'Navigation & Media', 'Pass', 1, NULL, '{$t4QaChecked}', 'Abeera', '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4km1001pv6mwqv6uaapz', 'cmv9a4km1001iv6mw1j89343v', 'CAPTIONS_TRANSCRIPTS', 'Closed captions, transcripts, and alternative formats provided', 'Accessibility', 'Pass', 1, NULL, '{$t4QaChecked}', 'Abeera', '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4km1001qv6mwh286rmt4', 'cmv9a4km1001iv6mw1j89343v', 'A11Y_BASICS', 'Accessibility: keyboard tabs, visible focus, screen reader tags, color contrast', 'Accessibility', 'Pass', 1, NULL, '{$t4QaChecked}', 'Abeera', '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4km1001rv6mw2r0dgww6', 'cmv9a4km1001iv6mw1j89343v', 'RESPONSIVE_BEHAVIOR', 'Mobile and tablet reflow tested across resolutions', 'Navigation & Media', 'Pass', 1, NULL, '{$t4QaChecked}', 'Abeera', '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4km1001sv6mwasro7aii', 'cmv9a4km1001iv6mw1j89343v', 'SCORM_PACKAGE', 'SCORM / xAPI manifest, passing score, and completion triggers validated', 'LMS & SCORM', 'Pass', 1, NULL, '{$t4QaChecked}', 'Abeera', '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4km1001tv6mww0me144t', 'cmv9a4km1001iv6mw1j89343v', 'LMS_LAUNCH', 'LMS test launch: bookmarking, resume state, and gradebook passback verified', 'LMS & SCORM', 'Pass', 1, NULL, '{$t4QaChecked}', 'Abeera', '{$nowStr}')");
        $pdo->exec("INSERT INTO `QACheck` (`id`, `workItemId`, `checkKey`, `title`, `category`, `status`, `isRequired`, `notes`, `checkedAt`, `checkedBy`, `updatedAt`) VALUES ('cmv9a4km1001uv6mwje9vtwzb', 'cmv9a4km1001iv6mw1j89343v', 'FINAL_APPROVAL', 'Final instructional design and stakeholder signoff recorded', 'Approval', 'Pass', 1, NULL, '{$t4QaChecked}', 'Abeera', '{$nowStr}')");

        // Table: DeliveryRecord (1 records)
        // deliveryDate = now - 2d, createdAt = now
        $delivDate = $rel(-2);
        $pdo->exec("INSERT INTO `DeliveryRecord` (`id`, `workItemId`, `deliveryFormat`, `packageVersion`, `destination`, `deliveryDate`, `handoffNotes`, `qaOverrideReason`, `deliveredBy`, `createdAt`) VALUES ('cmv9a4km2001vv6mwg3w9g6ky', 'cmv9a4km1001iv6mw1j89343v', 'PDF / Job Aid', '1.0.0', 'Intranet Knowledge Base', '{$delivDate}', 'Print-ready high-contrast PDF with accessibility bookmarks.', NULL, 'Abeera', '{$nowStr}')");

        // Table: ActivityEvent (1 records)
        // createdAt = now
        $pdo->exec("INSERT INTO `ActivityEvent` (`id`, `workItemId`, `projectId`, `eventType`, `previousStage`, `newStage`, `title`, `description`, `metadata`, `userEmail`, `createdAt`) VALUES ('cmv9a4kl6000nv6mwyynuooiy', 'cmv9a4kl5000av6mwemhf1pi6', NULL, 'STAGE_CHANGED', 'Learning Design / Storyboarding', 'E-Learning Development', 'Advanced to E-Learning Development', 'Storyboards approved by Dr. Vance.', NULL, 'Abeera@wb.com', '{$nowStr}')");

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}
