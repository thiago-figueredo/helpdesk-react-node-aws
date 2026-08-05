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
