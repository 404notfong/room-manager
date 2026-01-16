import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { RoomGroupsService } from './room-groups.service';
import { CreateRoomGroupDto, UpdateRoomGroupDto, GetRoomGroupsDto } from './dto/room-group.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('room-groups')
@UseGuards(JwtAuthGuard)
export class RoomGroupsController {
    constructor(private readonly roomGroupsService: RoomGroupsService) { }

    @Post()
    create(@CurrentUser() user: any, @Body() createRoomGroupDto: CreateRoomGroupDto) {
        return this.roomGroupsService.create(user.userId, createRoomGroupDto);
    }

    @Get()
    findAll(@CurrentUser() user: any, @Query() query: GetRoomGroupsDto) {
        return this.roomGroupsService.findAll(user.userId, query);
    }

    @Get(':id')
    findOne(@CurrentUser() user: any, @Param('id') id: string) {
        return this.roomGroupsService.findOne(id, user.userId);
    }

    @Put(':id')
    update(@CurrentUser() user: any, @Param('id') id: string, @Body() updateRoomGroupDto: UpdateRoomGroupDto) {
        return this.roomGroupsService.update(id, user.userId, updateRoomGroupDto);
    }

    @Delete(':id')
    remove(@CurrentUser() user: any, @Param('id') id: string) {
        return this.roomGroupsService.remove(id, user.userId);
    }
}
