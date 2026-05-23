import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssetImportDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serialNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  notes?: string;
}
