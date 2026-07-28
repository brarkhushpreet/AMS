import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(100),
    email: z.email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Z]/, "Add at least one uppercase letter")
      .regex(/[0-9]/, "Add at least one number"),
    confirmPassword: z.string(),
    role: z.enum(["STUDENT", "TEACHER"]),
    department: z.string().trim().max(100).optional(),
    registrationNumber: z.string().trim().max(80).optional(),
    className: z.string().trim().max(80).optional(),
    batch: z.string().trim().max(80).optional(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine(
    (value) =>
      value.role !== "STUDENT" || Boolean(value.registrationNumber?.trim()),
    {
      path: ["registrationNumber"],
      message: "Registration number is required for students",
    },
  );

export const classroomSchema = z.object({
  name: z.string().trim().min(2).max(100),
  subjectCode: z.string().trim().min(2).max(30),
  section: z.string().trim().max(50).optional(),
  academicTerm: z.string().trim().min(2).max(60),
});

export const joinClassroomSchema = z.object({
  joinCode: z.string().trim().min(6).max(10),
});

export const attendanceSessionSchema = z.object({
  classroomId: z.uuid(),
  method: z.enum(["GEOLOCATION", "ULTRASOUND"]),
  durationMinutes: z.number().int().min(1).max(30).default(5),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().int().min(10).max(500).optional(),
});

export type AuthActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
