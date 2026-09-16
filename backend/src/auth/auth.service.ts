import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { JwtPayload } from './jwt-payload.interface';

const SALT_ROUNDS = 10;

interface RegisterSchoolInput {
  schoolName?: string;
  email?: string;
  phone?: string;
  country?: string;
  password?: string;
}

interface RegisterAdminInput {
  email?: string;
  password?: string;
}

interface LoginInput {
  email?: string;
  password?: string;
}

export interface AuthResponse {
  access_token: string;
}

/**
 * AuthService — registration, login, and JWT issuance for both roles.
 * Token payload/shape is identical whether it comes from register or login.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async registerSchool(input: RegisterSchoolInput): Promise<AuthResponse> {
    const email = input.email?.trim().toLowerCase();
    const password = input.password;
    if (!email || !password) {
      throw new ConflictException('email and password are required');
    }

    await this.assertEmailAvailable(email);

    const user = this.userRepository.create({
      email,
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
      role: 'school',
      schoolName: input.schoolName?.trim() || null,
      phone: input.phone?.trim() || null,
      country: input.country?.trim() || null,
    });
    await this.userRepository.save(user);

    return this.issueToken(user);
  }

  async registerAdmin(input: RegisterAdminInput): Promise<AuthResponse> {
    const email = input.email?.trim().toLowerCase();
    const password = input.password;
    if (!email || !password) {
      throw new ConflictException('email and password are required');
    }

    await this.assertEmailAvailable(email);

    const user = this.userRepository.create({
      email,
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
      role: 'admin',
      schoolName: null,
      phone: null,
      country: null,
    });
    await this.userRepository.save(user);

    return this.issueToken(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const email = input.email?.trim().toLowerCase();
    const password = input.password;
    if (!email || !password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueToken(user);
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
  }

  private issueToken(user: User): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolName: user.schoolName,
    };
    return { access_token: this.jwtService.sign(payload) };
  }
}
