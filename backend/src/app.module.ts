import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { WinstonModule } from 'nest-winston';
import { I18nModule, AcceptLanguageResolver, QueryResolver, HeaderResolver } from 'nestjs-i18n';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, HttpAdapterHost } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as winston from 'winston';
import * as path from 'path';
import { DatabaseConfig } from '@config/database.config';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { BuildingsModule } from '@modules/buildings/buildings.module';
import { RoomsModule } from '@modules/rooms/rooms.module';
import { TenantsModule } from '@modules/tenants/tenants.module';
import { ContractsModule } from '@modules/contracts/contracts.module';
import { InvoicesModule } from '@modules/invoices/invoices.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { RoomGroupsModule } from '@modules/room-groups/room-groups.module';
import { ServicesModule } from '@modules/services/services.module';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';
import { AppController } from './app.controller';

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),

        // Rate Limiting - Global: 10 requests per 60 seconds
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 10,
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

