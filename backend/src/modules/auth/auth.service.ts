import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private i18n: I18nService,
    ) { }

    async register(registerDto: RegisterDto) {
        const user = await this.usersService.create(registerDto);
        const tokens = await this.generateTokens(user._id.toString(), user.email);

        await this.usersService.updateRefreshToken(
            user._id.toString(),
            tokens.refreshToken,
        );

        return {
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
            },
            ...tokens,
        };
    }

    async login(loginDto: LoginDto) {
        const user = await this.usersService.findByEmail(loginDto.email);

        if (!user) {
            throw new UnauthorizedException(this.i18n.t('auth.errors.invalidCredentials'));
        }

        const isPasswordValid = await bcrypt.compare(
            loginDto.password,
            user.password,
        );

        if (!isPasswordValid) {
            throw new UnauthorizedException(this.i18n.t('auth.errors.invalidCredentials'));
        }

        if (!user.isActive) {
            throw new UnauthorizedException(this.i18n.t('auth.errors.accountInactive'));
        }

        const tokens = await this.generateTokens(user._id.toString(), user.email);

        await this.usersService.updateRefreshToken(
            user._id.toString(),
            tokens.refreshToken,
        );

        return {
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
            },
            ...tokens,
        };
    }

    async refreshTokens(userId: string, refreshToken: string) {
        const user = await this.usersService.findOneDocument(userId);

        if (!user || !user.refreshToken) {
            throw new UnauthorizedException('Access denied');
        }

        const refreshTokenMatches = await bcrypt.compare(
            refreshToken,
            user.refreshToken,
        );

        if (!refreshTokenMatches) {
            throw new UnauthorizedException('Access denied');
        }

        const tokens = await this.generateTokens(user._id.toString(), user.email);

        await this.usersService.updateRefreshToken(
            user._id.toString(),
            tokens.refreshToken,
        );

        return tokens;
    }

    async logout(userId: string) {
        await this.usersService.updateRefreshToken(userId, null);
    }

    private async generateTokens(userId: string, email: string) {
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(
                { userId, email },
                {
                    secret: this.configService.get<string>('JWT_SECRET'),
                    expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'),
                },
            ),
            this.jwtService.signAsync(
                { userId, email },
                {
                    secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
                    expiresIn: this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN'),
                },
            ),
        ]);

        return {
            accessToken,
            refreshToken,
        };
    }
}
