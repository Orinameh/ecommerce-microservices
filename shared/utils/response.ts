import { type Response } from 'express';

export class ApiResponse {
  static success(res: Response, data: unknown, statusCode: number = 200) {
    return res.status(statusCode).json(data);
  }

  static created(res: Response, data: unknown) {
    return res.status(201).json(data);
  }

  static error(res: Response, message: string, statusCode: number = 500, requestId?: string) {
    const body: Record<string, unknown> = { error: message };
    if (requestId) body.requestId = requestId;
    body.timestamp = new Date().toISOString();
    return res.status(statusCode).json(body);
  }

  static badRequest(res: Response, message: string, requestId?: string) {
    return this.error(res, message, 400, requestId);
  }

  static notFound(res: Response, message: string = 'Resource not found', requestId?: string) {
    return this.error(res, message, 404, requestId);
  }

  static conflict(res: Response, message: string, requestId?: string) {
    return this.error(res, message, 409, requestId);
  }
}
