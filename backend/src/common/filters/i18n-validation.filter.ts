import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';

interface ValidationError {
    property: string;
    constraints?: Record<string, string>;
    children?: ValidationError[];
}

@Catch(BadRequestException)
export class I18nValidationExceptionFilter implements ExceptionFilter {
    constructor(private readonly i18n: I18nService) { }

    catch(exception: BadRequestException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse() as any;

        // If it's a validation error with message array
        if (Array.isArray(exceptionResponse.message)) {
            const i18nContext = I18nContext.current(host);
            const lang = i18nContext?.lang || 'en';

            const translatedMessages = exceptionResponse.message.map((msg: string) => {
                return this.translateMessage(msg, lang);
            });

            return response.status(status).json({
                statusCode: status,
                error: this.translateError(exceptionResponse.error, lang),
                message: translatedMessages,
            });
        }

        // Otherwise, return the original response
        return response.status(status).json(exceptionResponse);
    }

    private translateMessage(message: string, lang: string): string {
        // Parse the message to extract property and constraint
        // e.g., "name should not be empty" -> property: "name", constraint: "isNotEmpty"

        const patterns: { regex: RegExp; key: string; extractProperty: (match: RegExpMatchArray) => string }[] = [
            { regex: /^(.+) should not be empty$/, key: 'validation.isNotEmpty', extractProperty: (m) => m[1] },
            { regex: /^(.+) must be a string$/, key: 'validation.isString', extractProperty: (m) => m[1] },
            { regex: /^(.+) must be a number.*$/, key: 'validation.isNumber', extractProperty: (m) => m[1] },
            { regex: /^(.+) must be a valid email.*$/, key: 'validation.isEmail', extractProperty: (m) => m[1] },
            { regex: /^(.+) must be a mongodb id$/, key: 'validation.isMongoId', extractProperty: (m) => m[1] },
            { regex: /^(.+) must be a valid enum value$/, key: 'validation.isEnum', extractProperty: (m) => m[1] },
            { regex: /^(.+) must be an array$/, key: 'validation.isArray', extractProperty: (m) => m[1] },
            { regex: /^(.+) must be a boolean.*$/, key: 'validation.isBoolean', extractProperty: (m) => m[1] },
            { regex: /^(.+) must be longer than or equal to (\d+) characters$/, key: 'validation.minLength', extractProperty: (m) => m[1] },
            { regex: /^(.+) must be shorter than or equal to (\d+) characters$/, key: 'validation.maxLength', extractProperty: (m) => m[1] },
            { regex: /^(.+) must not be greater than (\d+)$/, key: 'validation.max', extractProperty: (m) => m[1] },
            { regex: /^(.+) must not be less than (\d+)$/, key: 'validation.min', extractProperty: (m) => m[1] },
            { regex: /^(.+) must be a positive number$/, key: 'validation.isPositive', extractProperty: (m) => m[1] },
            { regex: /^(.+) must be a Date instance$/, key: 'validation.isDateString', extractProperty: (m) => m[1] },
            { regex: /^property (.+) should not exist$/, key: 'validation.whitelistValidation', extractProperty: (m) => m[1] },
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern.regex);
            if (match) {
                const property = this.translateProperty(pattern.extractProperty(match), lang);
                const constraints = match[2] ? { '0': match[2] } : {};

                try {
                    const translated = this.i18n.translate(pattern.key, {
                        lang,
                        args: { property, constraints },
                    });
                    return typeof translated === 'string' ? translated : message;
                } catch {
                    return message;
                }
            }
        }

        return message;
    }

    private translateProperty(property: string, lang: string): string {
        // Handle nested properties like "address.street"
        const parts = property.split('.');
        const translatedParts = parts.map(part => {
            try {
                const key = `fields.${part}`;
                const translated = this.i18n.translate(key, { lang });
                return typeof translated === 'string' && translated !== key ? translated : part;
            } catch {
                return part;
            }
        });
        return translatedParts.join('.');
    }

    private translateError(error: string, lang: string): string {
        const errorMap: Record<string, string> = {
            'Bad Request': lang === 'vi' ? 'Yêu cầu không hợp lệ' : 'Bad Request',
            'Unauthorized': lang === 'vi' ? 'Không được phép' : 'Unauthorized',
            'Forbidden': lang === 'vi' ? 'Bị cấm' : 'Forbidden',
            'Not Found': lang === 'vi' ? 'Không tìm thấy' : 'Not Found',
        };
        return errorMap[error] || error;
    }
}
