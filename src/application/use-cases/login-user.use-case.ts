import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import {
  InvalidCredentialsError,
  UserInactiveError,
} from '../../domain/errors/domain.errors.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { AuthOutputDto } from '../dtos/auth-output.dto.js';
import { LoginUserDto } from '../dtos/login-user.dto.js';
import { PasswordHasherPort } from '../ports/password-hasher.port.js';
import { TokenServicePort } from '../ports/token-service.port.js';

@injectable()
export class LoginUserUseCase {
  constructor(
    @inject('UserRepository') private readonly users: UserRepository,
    @inject('PasswordHasher') private readonly hasher: PasswordHasherPort,
    @inject('TokenService') private readonly tokens: TokenServicePort,
    @inject('JwtAccessTtl') private readonly accessTtl: number,
  ) {}

  async execute(input: LoginUserDto): Promise<AuthOutputDto & { refreshToken: string }> {
    const email = Email.create(input.email);
    const user = await this.users.findByEmail(email);

    if (user === null) {
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new UserInactiveError();
    }

    const valid = await this.hasher.verify(
      user.passwordHash.toString(),
      input.password,
    );
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    const jti = crypto.randomUUID();
    const accessToken = this.tokens.signAccessToken({
      sub: user.id.toString(),
      jti,
    });
    const refreshToken = await this.tokens.issueRefreshToken(user.id.toString());

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTtl,
      refreshToken,
    };
  }
}
