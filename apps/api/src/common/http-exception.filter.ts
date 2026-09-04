import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
}

/**
 * Réponse d'erreur uniforme. Une exception inattendue ne doit jamais laisser
 * fuiter une trace de pile vers le client : elle est journalisée côté serveur
 * et remplacée par un message neutre.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<{ status(code: number): { json(body: ErrorBody): void } }>();
    const request = http.getRequest<{ url?: string }>();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttp ? exception.message : 'Erreur interne.';

    if (!isHttp) {
      this.logger.error(
        'Exception non gérée',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      statusCode,
      error: HttpStatus[statusCode],
      message,
      path: request.url ?? '',
      timestamp: new Date().toISOString(),
    });
  }
}
