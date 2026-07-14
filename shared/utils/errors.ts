export const MONGO_DUPLICATE_KEY_ERROR = 11000;

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
