// Error caused by invalid user input: the API answers with `status` (400 by default), never 500.
export class InputError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'InputError';
    this.status = status;
  }
}
