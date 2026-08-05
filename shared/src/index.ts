import { z } from "zod";

export const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantName: z.string().min(1),
  slaHours: z.number().int().positive().optional(),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const SignupResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    role: z.enum(["admin", "agent"]),
  }),
  tenant: z.object({
    id: z.string(),
    name: z.string(),
  }),
});
export type SignupResponse = z.infer<typeof SignupResponseSchema>;
