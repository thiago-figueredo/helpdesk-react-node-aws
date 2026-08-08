import { z } from "zod";

export const UserDtoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(["admin", "agent"]),
});
export type UserDto = z.infer<typeof UserDtoSchema>;

export const TenantDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type TenantDto = z.infer<typeof TenantDtoSchema>;

export const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantName: z.string().min(1),
  slaHours: z.number().int().positive().optional(),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const SignupResponseSchema = z.object({
  token: z.string(),
  user: UserDtoSchema,
  tenant: TenantDtoSchema,
});
export type SignupResponse = z.infer<typeof SignupResponseSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: UserDtoSchema,
  tenant: TenantDtoSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const TicketDtoSchema = z.object({
  id: z.string(),
  status: z.enum(["Open", "InProgress", "WaitingOnCustomer", "Closed"]),
  createdAt: z.string(),
});
export type TicketDto = z.infer<typeof TicketDtoSchema>;

export const CreateTicketRequestSchema = z.object({
  tenantName: z.string().min(1),
  customerEmail: z.string().email(),
  body: z.string().min(1),
});
export type CreateTicketRequest = z.infer<typeof CreateTicketRequestSchema>;

export const CreateTicketResponseSchema = z.object({
  trackingToken: z.string(),
  ticket: TicketDtoSchema,
});
export type CreateTicketResponse = z.infer<typeof CreateTicketResponseSchema>;

export const MessageDtoSchema = z.object({
  id: z.string(),
  senderType: z.enum(["customer", "agent"]),
  body: z.string(),
  createdAt: z.string(),
});
export type MessageDto = z.infer<typeof MessageDtoSchema>;

export const GetTicketByTokenRequestSchema = z.object({
  trackingToken: z.string().min(1),
});
export type GetTicketByTokenRequest = z.infer<typeof GetTicketByTokenRequestSchema>;

export const GetTicketByTokenResponseSchema = z.object({
  ticket: TicketDtoSchema,
  messages: z.array(MessageDtoSchema),
});
export type GetTicketByTokenResponse = z.infer<typeof GetTicketByTokenResponseSchema>;

export const ReplyToTicketRequestSchema = z.object({
  body: z.string().min(1),
});
export type ReplyToTicketRequest = z.infer<typeof ReplyToTicketRequestSchema>;

export const ReplyToTicketResponseSchema = z.object({
  ticket: TicketDtoSchema,
  message: MessageDtoSchema,
});
export type ReplyToTicketResponse = z.infer<typeof ReplyToTicketResponseSchema>;
