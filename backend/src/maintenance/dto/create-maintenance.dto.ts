import { IsNotEmpty, IsOptional, IsString, IsUUID, IsDateString, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaintenanceDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  technicianId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  cost?: number;
}
