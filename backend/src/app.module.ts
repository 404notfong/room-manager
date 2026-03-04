import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';
import { DatabaseConfig } from '@config/database.config';
import { AuthModule } from '@modules/auth/auth.module';
import { BuildingsModule } from '@modules/buildings/buildings.module';
import { CalendarModule } from '@modules/calendar/calendar.module';
import { ContractsModule } from '@modules/contracts/contracts.module';
import { InvoicesModule } from '@modules/invoices/invoices.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { RoomGroupsModule } from '@modules/room-groups/room-groups.module';
import { RoomsModule } from '@modules/rooms/rooms.module';
import { ServicesModule } from '@modules/services/services.module';
import { TenantsModule } from '@modules/tenants/tenants.module';
import { UsersModule } from '@modules/users/users.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';
import * as winston from 'winston';
import { AppController } from './app.controller';

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),

        // Rate Limiting - Global: 100 requests per 60 seconds (dev friendly)
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 100,
        }]),
        I18nModule.forRoot({
            fallbackLanguage: 'en',
            loaderOptions: {
                path: path.join(__dirname, '/i18n/'),
                watch: true,
            },
            resolvers: [
                { use: QueryResolver, options: ['lang'] },
                AcceptLanguageResolver,
                new HeaderResolver(['x-lang']),
            ],
        }),

        // Database
        MongooseModule.forRootAsync({
            useClass: DatabaseConfig,
        }),

        // Logging
        WinstonModule.forRoot({
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.colorize(),
                        winston.format.printf(({ timestamp, level, message, context, trace }) => {
                            return `${timestamp} [${context}] ${level}: ${message}${trace ? `\n${trace}` : ''} `;
                        }),
                    ),
                }),
                new winston.transports.File({
                    filename: 'logs/error.log',
                    level: 'error',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json(),
                    ),
                }),
                new winston.transports.File({
                    filename: 'logs/combined.log',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json(),
                    ),
                }),
            ],
        }),

        // Feature modules
        AuthModule,
        UsersModule,
        BuildingsModule,
        RoomsModule,
        TenantsModule,
        ContractsModule,
        InvoicesModule,
        PaymentsModule,
        RoomGroupsModule,
        ServicesModule,
        NotificationsModule,
        CalendarModule,
    ],
    controllers: [AppController],
    providers: [
        {
            provide: APP_FILTER,
            useClass: AllExceptionsFilter,
        },
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: LoggingInterceptor,
        },
    ],
})
export class AppModule { }

