import { Controller, Get, Put, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto, ChangePasswordDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/constants/enums';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('profile')
    getProfile(@CurrentUser() user: any) {
        return this.usersService.findOne(user.userId);
    }

    @Put('profile')
    updateProfile(@CurrentUser() user: any, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(user.userId, updateUserDto);
    }

    @Put('change-password')
    changePassword(
        @CurrentUser() user: any,
        @Body() changePasswordDto: ChangePasswordDto,
    ) {
        return this.usersService.changePassword(user.userId, changePasswordDto);
    }

    @Get()
    @Roles(UserRole.OWNER)
    findAll() {
        return this.usersService.findAll();
    }

    @Get(':id')
    @Roles(UserRole.OWNER)
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    @Put(':id')
    @Roles(UserRole.OWNER)
    update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(id, updateUserDto);
    }

    @Delete(':id')
    @Roles(UserRole.OWNER)
    remove(@Param('id') id: string) {
        return this.usersService.remove(id);
    }
}
