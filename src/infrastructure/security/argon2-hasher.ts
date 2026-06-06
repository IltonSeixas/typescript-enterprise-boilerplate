import 'reflect-metadata';
import argon2 from 'argon2';
import { injectable } from 'tsyringe';
import { PasswordHasherPort } from '../../application/ports/password-hasher.port.js';

@injectable()
export class Argon2Hasher implements PasswordHasherPort {
  private static readonly OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  } as const;

  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, Argon2Hasher.OPTIONS);
  }

  async verify(hash: string, plaintext: string): Promise<boolean> {
    return argon2.verify(hash, plaintext);
  }
}
