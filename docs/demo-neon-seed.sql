-- Run once in the Neon SQL Editor after applying Prisma migrations.
-- Safe to rerun: existing demo rows are left unchanged. No real accounts are touched.
BEGIN;

INSERT INTO "User" ("id", "email", "password", "role", "name", "createdAt", "updatedAt")
VALUES
  ('d3e00000-0000-4000-8000-000000000001', 'teacher@demo.classpulse.invalid', '!password-login-disabled!', 'TEACHER', 'Alex Morgan (Demo)', now(), now()),
  ('d3e00000-0000-4000-8000-000000000002', 'student@demo.classpulse.invalid', '!password-login-disabled!', 'STUDENT', 'Jamie Lee (Demo)', now(), now()),
  ('d3e00000-0000-4000-8000-000000000011', 'classmate-1@demo.classpulse.invalid', '!password-login-disabled!', 'STUDENT', 'Avery Chen', now(), now()),
  ('d3e00000-0000-4000-8000-000000000012', 'classmate-2@demo.classpulse.invalid', '!password-login-disabled!', 'STUDENT', 'Sam Rivera', now(), now()),
  ('d3e00000-0000-4000-8000-000000000013', 'classmate-3@demo.classpulse.invalid', '!password-login-disabled!', 'STUDENT', 'Taylor Reed', now(), now()),
  ('d3e00000-0000-4000-8000-000000000014', 'classmate-4@demo.classpulse.invalid', '!password-login-disabled!', 'STUDENT', 'Riley Patel', now(), now()),
  ('d3e00000-0000-4000-8000-000000000015', 'classmate-5@demo.classpulse.invalid', '!password-login-disabled!', 'STUDENT', 'Jordan Park', now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Teacher" ("id", "userId", "department", "createdAt", "updatedAt")
VALUES ('d3e00000-0000-4000-8000-000000000003', 'd3e00000-0000-4000-8000-000000000001', 'Computer Science', now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Student" ("id", "userId", "registrationNumber", "department", "className", "batch", "createdAt", "updatedAt")
VALUES
  ('d3e00000-0000-4000-8000-000000000021', 'd3e00000-0000-4000-8000-000000000002', 'PORTFOLIO-DEMO-1', 'Computer Science', 'B.Tech CSE', 'Demo cohort', now(), now()),
  ('d3e00000-0000-4000-8000-000000000022', 'd3e00000-0000-4000-8000-000000000011', 'PORTFOLIO-DEMO-2', 'Computer Science', 'B.Tech CSE', 'Demo cohort', now(), now()),
  ('d3e00000-0000-4000-8000-000000000023', 'd3e00000-0000-4000-8000-000000000012', 'PORTFOLIO-DEMO-3', 'Computer Science', 'B.Tech CSE', 'Demo cohort', now(), now()),
  ('d3e00000-0000-4000-8000-000000000024', 'd3e00000-0000-4000-8000-000000000013', 'PORTFOLIO-DEMO-4', 'Computer Science', 'B.Tech CSE', 'Demo cohort', now(), now()),
  ('d3e00000-0000-4000-8000-000000000025', 'd3e00000-0000-4000-8000-000000000014', 'PORTFOLIO-DEMO-5', 'Computer Science', 'B.Tech CSE', 'Demo cohort', now(), now()),
  ('d3e00000-0000-4000-8000-000000000026', 'd3e00000-0000-4000-8000-000000000015', 'PORTFOLIO-DEMO-6', 'Computer Science', 'B.Tech CSE', 'Demo cohort', now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Classroom" ("id", "name", "subjectCode", "joinCode", "section", "academicTerm", "teacherId", "createdAt", "updatedAt")
VALUES
  ('d3e00000-0000-4000-8000-000000000031', 'Data Structures', 'CS-204', 'DEMODSA', 'A', 'Demo semester', 'd3e00000-0000-4000-8000-000000000003', now(), now()),
  ('d3e00000-0000-4000-8000-000000000032', 'Operating Systems', 'CS-305', 'DEMOOS', 'B', 'Demo semester', 'd3e00000-0000-4000-8000-000000000003', now(), now())
ON CONFLICT ("id") DO NOTHING;

WITH demo_classes AS (
  SELECT * FROM (VALUES
    ('d3e00000-0000-4000-8000-000000000031'::text, 0),
    ('d3e00000-0000-4000-8000-000000000032'::text, 1)
  ) AS c(class_id, class_index)
)
INSERT INTO "Enrollment" ("id", "studentId", "classroomId", "joinedAt")
SELECT 'd3e00000-0000-4000-8000-' || lpad((2000 + class_index * 10 + student_index)::text, 12, '0'),
       'd3e00000-0000-4000-8000-' || lpad((21 + student_index)::text, 12, '0'),
       class_id, now()
FROM demo_classes CROSS JOIN generate_series(0, 5) AS students(student_index)
WHERE true
ON CONFLICT ("studentId", "classroomId") DO NOTHING;

WITH demo_sessions AS (
  SELECT c.class_id, c.class_index, s.session_index,
         date_trunc('day', now() AT TIME ZONE 'UTC')
           - ((10 - s.session_index) * 2 + c.class_index) * interval '1 day'
           + (9 + c.class_index) * interval '1 hour' AS started_at
  FROM (VALUES
    ('d3e00000-0000-4000-8000-000000000031'::text, 0),
    ('d3e00000-0000-4000-8000-000000000032'::text, 1)
  ) AS c(class_id, class_index)
  CROSS JOIN generate_series(0, 9) AS s(session_index)
)
INSERT INTO "AttendanceSession" ("id", "classroomId", "method", "status", "startedAt", "endsAt", "createdAt", "updatedAt")
SELECT 'd3e00000-0000-4000-8000-' || lpad((100 + class_index * 10 + session_index)::text, 12, '0'),
       class_id,
       (CASE WHEN session_index % 2 = 0 THEN 'GEOLOCATION' ELSE 'ULTRASOUND' END)::"AttendanceMethod",
       'CLOSED', started_at, started_at + interval '5 minutes', now(), now()
FROM demo_sessions
WHERE true
ON CONFLICT ("id") DO NOTHING;

WITH demo_sessions AS (
  SELECT c.class_index, s.session_index,
         'd3e00000-0000-4000-8000-' || lpad((100 + c.class_index * 10 + s.session_index)::text, 12, '0') AS session_id
  FROM (VALUES (0), (1)) AS c(class_index)
  CROSS JOIN generate_series(0, 9) AS s(session_index)
)
INSERT INTO "AttendanceRecord" ("id", "sessionId", "studentId", "status", "method", "deviceVerified", "verifiedAt", "createdAt", "updatedAt")
SELECT 'd3e00000-0000-4000-8000-' || lpad((1000 + d.class_index * 100 + d.session_index * 10 + student_index)::text, 12, '0'),
       d.session_id,
       'd3e00000-0000-4000-8000-' || lpad((21 + student_index)::text, 12, '0'),
       'PRESENT', a."method", false, a."startedAt" + interval '1 minute', now(), now()
FROM demo_sessions d
JOIN "AttendanceSession" a ON a."id" = d.session_id
CROSS JOIN generate_series(0, 5) AS students(student_index)
WHERE (d.session_index + student_index + d.class_index) % 5 <> 0
ON CONFLICT ("sessionId", "studentId") DO NOTHING;

COMMIT;

-- Expected: 7 users, 2 classrooms, 20 sessions, 96 attendance records.
SELECT
  (SELECT count(*) FROM "User" WHERE "email" LIKE '%@demo.classpulse.invalid') AS demo_users,
  (SELECT count(*) FROM "Classroom" WHERE "teacherId" = 'd3e00000-0000-4000-8000-000000000003') AS classrooms,
  (SELECT count(*) FROM "AttendanceSession" WHERE "classroomId" IN ('d3e00000-0000-4000-8000-000000000031', 'd3e00000-0000-4000-8000-000000000032')) AS sessions,
  (SELECT count(*) FROM "AttendanceRecord" WHERE "sessionId" IN (
    SELECT "id" FROM "AttendanceSession" WHERE "classroomId" IN ('d3e00000-0000-4000-8000-000000000031', 'd3e00000-0000-4000-8000-000000000032')
  )) AS attendance_records;
