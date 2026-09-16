import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Requires a valid bearer JWT (see JwtStrategy); no role restriction. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
