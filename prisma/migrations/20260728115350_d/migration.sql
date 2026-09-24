-- AlterTable
ALTER TABLE "AttendanceRecord" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "AttendanceRecord" RENAME CONSTRAINT "AttendanceRecord_new_pkey" TO "AttendanceRecord_pkey";

-- AlterTable
ALTER TABLE "AttendanceSession" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Classroom" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Classroom" RENAME CONSTRAINT "Classroom_new_pkey" TO "Classroom_pkey";

-- AlterTable
ALTER TABLE "ClassroomInvitation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Enrollment" RENAME CONSTRAINT "Enrollment_new_pkey" TO "Enrollment_pkey";

-- AlterTable
ALTER TABLE "PasskeyCredential" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PresenceVerification" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Teacher" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
