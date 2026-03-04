import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { ContractsService } from '@modules/contracts/contracts.service';
import { ActivateContractDto, CreateContractDto, GetContractsDto, TerminateContractDto, UpdateContractDto } from '@modules/contracts/dto/contract.dto';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';

@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
    constructor(private readonly contractsService: ContractsService) { }

    @Post()
    create(@CurrentUser() user: any, @Body() createContractDto: CreateContractDto) {
        return this.contractsService.create(user.userId, createContractDto);
    }

    @Get()
    findAll(@CurrentUser() user: any, @Query() query: GetContractsDto) {
        return this.contractsService.findAll(user.userId, query);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: any) {
        return this.contractsService.findOne(id, user.userId);
    }

    @Put(':id')
    update(@Param('id') id: string, @CurrentUser() user: any, @Body() updateContractDto: UpdateContractDto) {
        return this.contractsService.update(id, user.userId, updateContractDto);
    }

    @Put(':id/activate')
    activate(@Param('id') id: string, @Body() activateContractDto: ActivateContractDto, @CurrentUser() user: any) {
        return this.contractsService.activate(id, user.userId, activateContractDto);
    }

    @Patch(':id/terminate')
    terminate(
        @Param('id') id: string, 
        @Body() terminateDto: TerminateContractDto,
        @Query('closeTenant') closeTenant: string,
        @CurrentUser() user: any
    ) {
        return this.contractsService.terminate(id, user.userId, terminateDto, closeTenant === 'true');
    }

    @Delete(':id')
    remove(@Param('id') id: string, @CurrentUser() user: any) {
        return this.contractsService.remove(id, user.userId);
    }
}
