-- Correlated subqueries in platform tenant outcome-attention rollups filter by assessmentId + status.
CREATE INDEX "Submission_assessmentId_status_idx" ON "Submission" ("assessmentId", "status");

-- Narrow scans for published assessments joined to courses (fleet + per-org rollups).
CREATE INDEX "Assessment_published_courseId_idx" ON "Assessment" ("published", "courseId");
