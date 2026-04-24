import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { Asset } from '../assets/entities/asset.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, User])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
