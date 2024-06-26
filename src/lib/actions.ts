"use server";
import * as z from "zod";

import bcrypt from "bcryptjs";
import { db } from "./db";

import { signIn } from "./auth";
import {
  DEFAULT_LOGIN_REDIRECT,
  DEFAULT_ADMIN_LOGIN_REDIRECT,
  DEFAULT_TEACHER_LOGIN_REDIRECT,
  DEFAULT_STUDENT_LOGIN_REDIRECT,
} from "@/routes";
import { AuthError } from "next-auth";
import { AssignCourseToTeacherSchema, FormSchema, LoginSchema } from "./Schema";
import { AttendanceStatus, Role } from "@prisma/client";
import { currentProfile } from "./currentProfile";

export const login = async (values: z.infer<typeof LoginSchema>) => {
  const validatedFields = LoginSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: "Invalid fields" };
  }
  const { email, password } = validatedFields.data;

  const user = await db.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    return { error: "User not found" };
  }
  const role = user.role;
  let url = DEFAULT_LOGIN_REDIRECT;
  try {
    if (role === Role.ADMIN) {
      url = DEFAULT_ADMIN_LOGIN_REDIRECT;
    } else if (role === Role.TEACHER) {
      url = DEFAULT_TEACHER_LOGIN_REDIRECT;
    } else {
      url = DEFAULT_STUDENT_LOGIN_REDIRECT;
    }
    await signIn("credentials", {
      email,
      password,
      redirectTo: url,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid Credentials" };

        default:
          return { error: "Something went wrong" };
      }
    }
    throw error;
  }

  return { success: "Success" };
};

export const signup = async (
  values: z.infer<typeof FormSchema>,
  path: string
) => {
  const validatedFields = FormSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Invalid fields" };
  }

  const {
    email,
    password,
    username,
    confirmPassword,
    role,
    branch,
    registrationNumber,
  } = validatedFields.data;
  const userBranch = branch !== undefined ? branch : "";
  const regNumber = registrationNumber !== undefined ? registrationNumber : "";

  if (password !== confirmPassword) {
    return { error: "Passwords do not Match" };
  }

  const existingUser = await db.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    return { error: "User Already Exists" };
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await db.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      role,
    },
  });
  if (role === "STUDENT") {
    await db.student.create({
      data: {
        userId: newUser.id,
        branch: userBranch,
        registrationNumber: regNumber,
      },
    });
  } else if (role === "TEACHER") {
    await db.teacher.create({
      data: {
        userId: newUser.id,
        department: userBranch,
      },
    });
  } else if (role === "ADMIN") {
    return { error: "you are not authorized to register as an admin" };
  }
  //login in user after sign
  let url = DEFAULT_LOGIN_REDIRECT;
  if (path.includes("auth")) {
    try {
      if (newUser.role === Role.ADMIN) {
        url = DEFAULT_ADMIN_LOGIN_REDIRECT;
      } else if (role === Role.TEACHER) {
        url = DEFAULT_TEACHER_LOGIN_REDIRECT;
      } else {
        url = DEFAULT_STUDENT_LOGIN_REDIRECT;
      }
      await signIn("credentials", {
        email,
        password,
        redirectTo: url,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case "CredentialsSignin":
            return { error: "Invalid Credentials" };

          default:
            return { error: "Something went wrong" };
        }
      }
      throw error;
    }
  }

  return { success: `${username} as ${role} is added` };
};

// server/actions.ts

export async function addCourse(
  name: string,
  code: string,
  department: string,
  session: string
) {
  try {
    // Check if the course already exists
    const existingCourse = await db.course.findFirst({
      where: {
        code,
        session,
      },
    });

    if (existingCourse) {
      return {
        error: `Course with code ${code} and session ${session} already exists`,
      };
    }

    // Create the new course
    const course = await db.course.create({
      data: {
        department,
        name,
        code,
        session,
      },
    });

    return { success: `${name} has been successfully Added` };
  } catch (error) {
    return { error: "Something went wrong" };
  }
}

export const assignCourseToTeacher = async (values: {
  teacherId: string;
  courseId: string;
  department: string;
}) => {
  // Find the teacher by name
  const { teacherId, courseId } = values;
  const teacher = await db.teacher.findUnique({
    where: {
      id: teacherId,
    },
    include: {
      user: true,
    },
  });

  if (!teacher) {
    return { error: `There is no teacher with this name` };
  }

  // Find the course by name
  const course = await db.course.findUnique({
    where: {
      id: courseId,
    },
  });

  if (!course) {
    return { error: `No such Course exists` };
  }

  // Check if the departments match
  if (teacher.department !== course.department) {
    return {
      error: `Teacher's department (${teacher.department}) does not match course's department (${course.department})`,
    };
  }

  // Check if the relationship already exists
  const existingRelation = await db.course.findFirst({
    where: {
      id: course.id,
      teachers: {
        some: {
          id: teacher.id,
        },
      },
    },
  });

  if (existingRelation) {
    return {
      error: `Course ${course.name} is already assigned to ${teacher.user.username}`,
    };
  }

  // Assign the course to the teacher
  const updatedCourse = await db.course.update({
    where: {
      id: courseId,
    },
    data: {
      teachers: {
        connect: {
          id: teacherId,
        },
      },
    },
  });

  return {
    success: `Course ${course.name} has been successfully assigned to ${teacher.user.username}`,
  };
};

export const getEnrolledCourses = async (studentName: string) => {
  // Find the course by name and include the teachers
  const studentWithCourses = await db.student.findFirst({
    where: {
      user: {
        username: studentName,
      },
    },
    include: {
      courses: true,
    },
  });

  if (!studentWithCourses) {
    return { error: `Student with name ${studentName} not found` };
  }
  const simplifiedCourses = studentWithCourses.courses.map((course) => ({
    id: course.id,
    name: course.name,
    code: course.code,
    session: course.session,
    department: course.department,
  }));

  return { courses: simplifiedCourses };
};

export const getCoursesForTeacher = async (teacherName: string) => {
  // Find the teacher by name and include the courses
  const teacherWithCourses = await db.teacher.findFirst({
    where: {
      user: {
        username: teacherName,
      },
    },
    include: {
      courses: true,
    },
  });

  if (!teacherWithCourses) {
    return { error: `Teacher with name ${teacherName} not found` };
  }
  const simplifiedCourses = teacherWithCourses.courses.map((course) => ({
    id: course.id,
    name: course.name,
    code: course.code,
    session: course.session,
    department: course.department,
  }));

  return { courses: simplifiedCourses };
};

export const enrollStudentInCourse = async (values: {
  studentId: string;
  teacherId: string;
  courseId: string;
  department: string;
}) => {
  const { studentId, teacherId, courseId } = values;

  console.log(values);

  // Find the student by user name
  const student = await db.student.findUnique({
    where: {
      id: studentId,
    },
    include: {
      user: true,
    },
  });

  if (!student) {
    return { error: `Student not found` };
  }

  // Find the teacher by user name
  const teacher = await db.teacher.findUnique({
    where: {
      id: teacherId,
    },
    include: {
      user: true,
    },
  });

  if (!teacher) {
    return { error: `Teacher not found` };
  }

  // Find the course by name
  const course = await db.course.findUnique({
    where: {
      id: courseId,
    },
    include: {
      teachers: true,
      students: true,
    },
  });

  if (!course) {
    return { error: `Course not found` };
  }

  // Check if the course is assigned to the teacher
  const isCourseAssignedToTeacher = course.teachers.some(
    (t) => t.id === teacher.id
  );

  if (!isCourseAssignedToTeacher) {
    return {
      error: `Course ${course.name} is not assigned to teacher ${teacher.user.username}`,
    };
  }

  // Check if the student is already enrolled in the course
  const isStudentEnrolled = await db.enrollment.findFirst({
    where: {
      studentId: student.id,
      courseId: course.id,
      teacherId: teacher.id,
    },
  });

  if (isStudentEnrolled) {
    return {
      error: `Student ${student.user.username} is already enrolled in course ${course.name}`,
    };
  }

  // Enroll the student in the course
  await db.enrollment.create({
    data: {
      studentId: student.id,
      courseId: course.id,
      teacherId: teacher.id,
    },
  });
  await db.course.update({
    where: {
      id: course.id,
    },
    data: {
      students: {
        connect: {
          id: student.id,
        },
      },
    },
  });

  return {
    success: `Student ${student.user.username} has been successfully enrolled in course ${course.name}`,
  };
};

export async function getStudentsByTeacherAndCourse(
  teacherName: string,
  courseId: string
) {
  try {
    // Find the teacher by user name
    const teacherUser = await db.user.findFirst({
      where: {
        username: teacherName,
      },
      include: {
        teacher: true,
      },
    });

    if (!teacherUser || !teacherUser.teacher) {
      return { error: `Teacher with name ${teacherName} not found` };
    }

    const teacher = teacherUser.teacher;

    // Find the course by name
    const course = await db.course.findFirst({
      where: {
        id: courseId,
      },
      include: {
        teachers: true,
        students: true,
      },
    });

    if (!course) {
      return { error: `Course  not found` };
    }

    // Check if the course is assigned to the teacher
    const isCourseAssignedToTeacher = course.teachers.some(
      (t) => t.id === teacher.id
    );

    if (!isCourseAssignedToTeacher) {
      return { error: `This course is not assigned to teacher ${teacherName}` };
    }

    const students = await db.student.findMany({
      where: {
        enrollments: {
          some: {
            course: {
              id: courseId,
            },
            teacher: {
              user: {
                username: teacherName,
              },
            },
          },
        },
      },
      include: {
        user: true,
      },
    });

    const simplifiedStudents = students.map((student) => ({
      username: student.user.username,
      email: student.user.email,
      branch: student.branch, // Assuming 'branch' is a field in user
    }));

    return { students: simplifiedStudents };
  } catch (error) {
    return { error: "Something went wrong" };
  }
}

export async function generateQRCode(userId: string, courseId: string) {
  try {
    const teacher = await db.teacher.findUnique({
      where: { id: userId },
      include: { user: true },
    });

    if (!teacher) {
      return { error: "Teacher not found for the given user ID" };
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return { error: "Course not found" };
    }

    // Set expiration time (e.g., 5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Check if a QR code already exists for this teacher and course
    let qrCodeRecord = await db.qRCode.findFirst({
      where: {
        teacherId: teacher.id,
        courseId: courseId,
      },
    });

    if (qrCodeRecord) {
      // Update the existing QR code with a new expiration time
      qrCodeRecord = await db.qRCode.update({
        where: { id: qrCodeRecord.id },
        data: {
          expiresAt,
          code: Math.random().toString(36).substring(2, 15), // Generate a new code
        },
      });
    } else {
      // Create a new QR code if one doesn't exist
      qrCodeRecord = await db.qRCode.create({
        data: {
          code: Math.random().toString(36).substring(2, 15),
          teacherId: teacher.id,
          courseId,
          expiresAt,
        },
      });
    }
    return {
      success: true,
      code: qrCodeRecord.code,
      expiresAt: qrCodeRecord.expiresAt.toISOString(),
      qrCodeId: qrCodeRecord.id, // Include the QR code ID in the response
    };
  } catch (error) {
    console.error("Error generating QR code:", error);
    return { error: "Error while generating QR code" };
  }
}

export async function markAttendance(data: string) {
  try {
    const decodedData = JSON.parse(atob(data));
    const { teacherId, courseId, code, expiresAt, qrCodeId } = decodedData;

    // Check if the QR code has expired
    if (new Date() > new Date(expiresAt)) {
      return { error: "QR code has expired" };
    }

    // Verify the QR code in the database
    const qrCode = await db.qRCode.findUnique({
      where: { id: qrCodeId },
      include: { teacher: true, course: true },
    });

    if (!qrCode) {
      return { error: "QR code is missing" };
    }
    if (qrCode.courseId !== courseId) {
      return { error: "Course ID does not match" };
    }
    if (qrCode.teacherId !== teacherId) {
      return { error: "Teacher ID does not match" };
    }
    if (qrCode.code !== code) {
      return { error: "QR code does not match" };
    }

    // Get the current user (student)
    const currentUser = await currentProfile();
    if (!currentUser || currentUser.role !== Role.STUDENT) {
      return { error: "User not authenticated or not a student" };
    }

    const student = await db.student.findUnique({
      where: { userId: currentUser.id },
      include: { courses: true },
    });

    if (!student) {
      return { error: "Student not found" };
    }

    // Check if the student is enrolled in the course
    const isEnrolled = student.courses.some((course) => course.id === courseId);
    if (!isEnrolled) {
      return { error: "Student is not enrolled in this course" };
    }

    // Get today's date (without time)

    // Check if attendance has already been marked for today
    const sixteenHoursAgo = new Date(Date.now() -  2*60*60 * 1000);

    const existingAttendance = await db.attendanceRecord.findFirst({
      where: {
        studentId: student.id,
        courseId: courseId,
        teacherId,
        date: {
          gte: sixteenHoursAgo,
        },
      },
      orderBy: {
        date: "desc",
      },
    });
    console.log(existingAttendance?.date.toLocaleString())
    if (existingAttendance) {
      return { error: "You have already marked your attendence for today" };
    }
    // Mark attendance
    const attendanceRecord = await db.attendanceRecord.create({
      data: {
        studentId: student.id,
        courseId,
        teacherId,
        qrCodeId,
        session: "2024",
        status: AttendanceStatus.PRESENT,
        date: new Date(), // Set to current date and time
      },
    });

    return { success: "Attendance marked successfully" };
  } catch (error) {
    console.error("Error marking attendance:", error);
    return { error: "An error occurred while marking attendance" };
  }
}

export async function getAllTeachersAndCourses() {
  try {
    const fetchedTeachers = await db.teacher.findMany({
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        department: true,
      },
    });

    if (!fetchedTeachers) {
      return { error: "no teachers found" };
    }
    const teachers = fetchedTeachers.map((teacher) => ({
      department: teacher.department,
      id: teacher.id,
      name: teacher.user.username,
    }));

    const courses = await db.course.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        department: true,
      },
    });
    if (!courses) {
      return { error: "no teachers and courses found" };
    }

    return {
      teachers,
      courses,
    };
  } catch (error) {
    console.error("Error fetching teachers and courses:", error);
    return { error: "Error fetching teachers and courses" };
  }
}

// app/actions/getTeachersByDepartment.ts

export async function getTeachersByDepartment(department: string) {
  try {
    const teachers = await db.teacher.findMany({
      where: {
        department: department,
      },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });
    if (!teachers || teachers.length === 0) {
      return { error: "no teacher found" };
    }

    const simplifiedTeachers = teachers.map((teacher) => ({
      department: teacher.department,
      teacherId: teacher.id,
      username: teacher.user.username,
    }));

    return { data: simplifiedTeachers };
  } catch (error) {
    console.error("Error fetching teachers:", error);
    return { error: "Error while fetching teachers" };
  }
}

export async function getCoursesByDepartmentAndTeacher(
  department: string,
  teacherId: string
) {
  try {
    const courses = await db.course.findMany({
      where: {
        department: department,
        teachers: {
          some: {
            id: teacherId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    if (!courses || courses.length === 0) {
      return {
        error: "No courses found for this teacher in the specified department",
      };
    }

    return { data: courses };
  } catch (error) {
    console.error("Error fetching courses:", error);
    return { error: "Error while fetching courses" };
  }
}

export async function getAllStudents() {
  try {
    const students = await db.student.findMany({
      select: {
        id: true,
        branch: true,
        registrationNumber: true,
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!students || students.length === 0) {
      return { error: "No students found" };
    }

    const simplifiedStudents = students.map((student) => ({
      id: student.id,
      username: student.user.username,
      email: student.user.email,
      branch: student.branch,
      registrationNumber: student.registrationNumber,
    }));

    return { data: simplifiedStudents };
  } catch (error) {
    console.error("Error fetching students:", error);
    return { error: "Error while fetching students" };
  }
}
