export interface User {
  id: string;
  tenantId: string;
  email: string;
  role: "admin" | "agent";
}
