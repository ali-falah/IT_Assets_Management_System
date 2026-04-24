import { IsNotEmpty, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssignmentDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  assignedAt: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
