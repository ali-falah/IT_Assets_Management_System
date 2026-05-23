import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateAssignmentDto } from './create-assignment.dto';

export class UpdateAssignmentDto extends PartialType(CreateAssignmentDto) {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  returnedAt?: string;
}
