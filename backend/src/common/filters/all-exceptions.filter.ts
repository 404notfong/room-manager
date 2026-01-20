import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger('AllExceptionsFilter');

    constructor(private readonly httpAdapterHost: HttpAdapterHost) { }

    catch(exception: unknown, host: ArgumentsHost): void {
        // In certain situations `httpAdapter` might not be available in the
        // constructor method, thus we should resolve it here.
        const { httpAdapter } = this.httpAdapterHost;

        const ctx = host.switchToHttp();
        const request = ctx.getRequest();

        const httpStatus =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const responseBody: any = {
            statusCode: httpStatus,
            timestamp: new Date().toISOString(),
            path: httpAdapter.getRequestUrl(request),
            method: httpAdapter.getRequestMethod(request),
            message: (exception as any)?.response?.message || (exception as any).message || 'Internal server error',
            error: (exception as any)?.response?.error || (exception as Error).name || 'Error',
        };

        // If it's a validation error, try to extract detailed errors
        if ((exception as any)?.errors) {
            responseBody.errors = (exception as any).errors;
        } else if ((exception as any)?.response?.errors) {
            responseBody.errors = (exception as any).response.errors;
        }

        // Log the error
        const scrubSensitiveData = (data: any) => {
            if (!data || typeof data !== 'object') return data;
            const scrubbed = { ...data };
            const sensitiveKeys = ['password', 'refreshToken', 'currentPassword', 'newPassword'];
            for (const key of sensitiveKeys) {
                if (key in scrubbed) scrubbed[key] = '***';
            }
            return scrubbed;
        };

        const logData = {
            ...responseBody,
            body: scrubSensitiveData(request.body),
            query: request.query,
            params: request.params,
        };

        if (httpStatus >= 500) {
            this.logger.error(
                `${request.method} ${request.url} - Error: ${JSON.stringify(logData)}`,
                (exception as Error),
            );
        } else {
            this.logger.warn(
                `${request.method} ${request.url} - Status: ${httpStatus} - Message: ${JSON.stringify(responseBody)}`,
            );
        }

        httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
    }
}
