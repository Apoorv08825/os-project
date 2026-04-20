import { z } from "zod";
import zxcvbn from "zxcvbn";

/**
 * Password policy: 8–128 chars, must contain upper, lower, digit, special.
 * Length-capped to prevent buffer-overflow-style abuse.
 */
export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "Max 128 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[0-9]/, "Must contain a digit")
  .regex(/[^A-Za-z0-9]/, "Must contain a special character");

export const emailSchema = z
  .string()
  .trim()
  .email("Invalid email")
  .max(254, "Email too long");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(64, "Max 64 characters")
  .regex(/^[\p{L}\p{N} _.\-']+$/u, "Invalid characters");

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  feedback: string;
  color: string;
};

export function evaluatePassword(pw: string): PasswordStrength {
  if (!pw) {
    return { score: 0, label: "Empty", feedback: "", color: "bg-muted" };
  }
  const r = zxcvbn(pw);
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Excellent"] as const;
  const colors = [
    "bg-destructive",
    "bg-destructive",
    "bg-warning",
    "bg-accent",
    "bg-success",
  ];
  return {
    score: r.score as 0 | 1 | 2 | 3 | 4,
    label: labels[r.score],
    feedback:
      r.feedback.warning ||
      r.feedback.suggestions[0] ||
      (r.score >= 3 ? "Looks good." : "Add more variety."),
    color: colors[r.score],
  };
}
