import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '../errors';

interface ErrorResponseBody {
  status: 'error';
  message: string;
  code: string;
  errors?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Domain errors — expected, safe to expose message + code.
    if (exception instanceof AppError) {
      this.logger.warn(`${exception.code}: ${exception.message}`, {
        path: request.url,
        method: request.method,
      });

      const body: ErrorResponseBody = {
        status: 'error',
        message: exception.message,
        code: exception.code,
      };
      if (exception.details) body.errors = exception.details;

      return response.status(exception.httpStatus).json(body);
    }

    // Nest's own HttpException (e.g. ValidationPipe failures, NotFoundException from guards).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as any)?.message ?? exception.message);

      const body: ErrorResponseBody = {
        status: 'error',
        message: Array.isArray(message) ? 'Validation failed' : message,
        code: status === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR' : 'HTTP_ERROR',
      };
      if (Array.isArray(message)) body.errors = message;

      return response.status(status).json(body);
    }

    // Unknown / programmer error — never leak details to the caller.
    const err = exception as Error;
    this.logger.error(err?.message ?? 'Unhandled error', err?.stack, {
      path: request.url,
      method: request.method,
    });

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    } satisfies ErrorResponseBody);
  }
}
