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
