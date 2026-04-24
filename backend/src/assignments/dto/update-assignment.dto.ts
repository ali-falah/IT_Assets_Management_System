import { PartialType } from '@nestjs/swagger';
import { CreateAssignmentDto } from './create-assignment.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class UpdateAssignmentDto extends PartialType(CreateAssignmentDto) {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  returnedAt?: string;
}
