import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto, GetServicesDto } from './dto/service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
    constructor(private readonly servicesService: ServicesService) { }

    @Post()
    create(@CurrentUser() user: any, @Body() createServiceDto: CreateServiceDto) {
        return this.servicesService.create(user.userId, createServiceDto);
    }

    @Get()
    findAll(@CurrentUser() user: any, @Query() query: GetServicesDto) {
        return this.servicesService.findAll(user.userId, query);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: any) {
        return this.servicesService.findOne(id, user.userId);
    }

    @Put(':id')
    update(@Param('id') id: string, @CurrentUser() user: any, @Body() updateServiceDto: UpdateServiceDto) {
        return this.servicesService.update(id, user.userId, updateServiceDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @CurrentUser() user: any) {
        return this.servicesService.remove(id, user.userId);
    }
}
