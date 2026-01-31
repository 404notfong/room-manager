import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);

    try {
        const connection = app.get<Connection>(getConnectionToken());

        console.log('Clearing database...');
        await connection.dropDatabase();
        console.log('Database cleared successfully.');

    } catch (error) {
        console.error('Clear database failed:', error);
    } finally {
        await app.close();
        process.exit(0);
    }
}

bootstrap();
