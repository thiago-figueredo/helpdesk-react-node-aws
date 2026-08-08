export class DomainError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class DuplicateEmailError extends DomainError {
  constructor() {
    super(409, "Email already in use");
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super(401, "Invalid email or password");
  }
}

export class TenantNotFoundError extends DomainError {
  constructor() {
    super(404, "Tenant not found");
  }
}

export class TenantNameTakenError extends DomainError {
  constructor() {
    super(409, "Tenant name already taken");
  }
}

export class TicketNotFoundError extends DomainError {
  constructor() {
    super(404, "Ticket not found");
  }
}

export class TicketStatusConflictError extends DomainError {
  constructor(actual: string, expected: string | string[]) {
    const expectedDescription = Array.isArray(expected)
      ? `expected one of ${expected.join(", ")}`
      : `expected ${expected}`;
    super(409, `Ticket status is ${actual}, ${expectedDescription}.`);
  }
}

export class NotAssignedAgentError extends DomainError {
  constructor() {
    super(403, "You are not the assigned agent for this ticket");
  }
}
