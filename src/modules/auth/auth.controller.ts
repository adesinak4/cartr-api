import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { RefreshDto } from './dto/refresh.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { User } from '../../db/schema';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async login(@Body() _dto: LoginDto, @Req() req: Request) {
    // LocalAuthGuard has already validated credentials and attached the user.
    const user = req.user as User;
    return this.authService.login(user);
  }

  /** Login only — never creates a new account, see AuthService.loginWithGoogle. */
  @Public()
  @Post('google')
  async loginWithGoogle(@Body() dto: GoogleLoginDto) {
    const profile = await this.googleAuthService.verifyIdToken(dto.idToken);
    return this.authService.loginWithGoogle(profile);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() dto: RefreshDto, @CurrentUser() user: AuthenticatedUser) {
    await this.authService.logout(dto.refreshToken, user.jti, user.exp);
    return { loggedOut: true };
  }
}
