import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * AuthController — registration and login. `register-admin` is public but
 * intentionally undiscoverable: no frontend route calls it, it exists only
 * for creating customer-service accounts via Postman.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body()
    body: {
      schoolName?: string;
      email?: string;
      phone?: string;
      country?: string;
      password?: string;
    },
  ) {
    return this.authService.registerSchool(body);
  }

  @Post('register-admin')
  registerAdmin(@Body() body: { email?: string; password?: string }) {
    return this.authService.registerAdmin(body);
  }

  @Post('login')
  login(@Body() body: { email?: string; password?: string }) {
    return this.authService.login(body);
  }
}
