import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) { }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      const roleName = user.role?.name ?? user.role;
      if (roleName === 'employee') {
        throw new UnauthorizedException('Employees do not have system access');
      }
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, rememberMe: boolean = false) {
    // user.role is now a UserRole object { id, name, ... } — store only the name in JWT
    const roleName = user.role?.name ?? user.role ?? 'viewer';
    const payload = { email: user.email, sub: user.id, role: roleName };

    // If rememberMe is true, set a 30-day expiry
    const signOptions: JwtSignOptions = rememberMe ? { expiresIn: '30d' } : {};

    return {
      access_token: this.jwtService.sign(payload, signOptions),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: roleName,
      }
    };
  }

  async logout(token: string, expiresIn: number) {
    // expiresIn from jwt payload is absolute unix time
    // ttl = expiresIn - current time
    const ttl = expiresIn - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redisService.set(`bl_${token}`, 'true', ttl);
    }
  }
}
