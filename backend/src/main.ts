import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { I18nValidationPipe } from 'nestjs-i18n';
import express from 'express';

const server = express();
let appPromise: Promise<any> | null = null;

async function bootstrap() {
    const isVercel = process.env.VERCEL === '1';

    // Create app with Express adapter if on Vercel
    const app = isVercel
        ? await NestFactory.create(AppModule, new ExpressAdapter(server))
        : await NestFactory.create(AppModule);

    const configService = app.get(ConfigService);
    app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

    // Enable CORS
    const corsOrigins = isVercel
        ? ['https://nhatroso.vercel.app', 'http://localhost:5173', 'http://localhost:5174']
        : (configService.get('CORS_ORIGIN')?.split(',') || ['http://localhost:5173', 'http://localhost:5174']);

    app.enableCors({
        origin: corsOrigins,
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type,Accept,Authorization,x-lang',
    });

    app.setGlobalPrefix(configService.get('API_PREFIX') || 'api');

    app.useGlobalPipes(
        new I18nValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    if (isVercel) {
        await app.init();
        console.log('NestJS initialized for Vercel');
        return app;
    } else {
        const port = process.env.PORT || 3000;
        await app.listen(port);
        console.log(`🚀 Application is running on: http://localhost:${port}/${configService.get('API_PREFIX') || 'api'}`);
    }
}

// Global handler for Vercel
export default async function handler(req: any, res: any) {
    if (process.env.VERCEL) {
        // Manual CORS handling for Vercel edge/preflight
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', 'https://nhatroso.vercel.app');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-lang'
        );

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        if (!appPromise) {
            appPromise = bootstrap();
        }
        await appPromise;
        server(req, res);
    }
}

// Start if running locally
if (!process.env.VERCEL) {
    bootstrap();
}
