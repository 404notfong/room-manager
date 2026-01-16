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
    console.log('Bootstrapping NestJS for Vercel...');
    const app = await NestFactory.create(
        AppModule,
        new ExpressAdapter(server),
    );

    const configService = app.get(ConfigService);
    app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

    app.enableCors({
        origin: ['https://nhatroso.vercel.app', 'http://localhost:5173', 'http://localhost:5174'],
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type,Accept,Authorization,x-lang',
    });

    app.setGlobalPrefix('api');

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

    await app.init();
    console.log('NestJS initialized');
    return app;
}

export default async function handler(req: any, res: any) {
    // Manual CORS handling for Vercel
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', 'https://nhatroso.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-lang'
    );

    // Handle preflight request
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
