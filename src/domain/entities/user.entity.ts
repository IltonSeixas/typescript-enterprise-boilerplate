import { Email } from '../value-objects/email.vo.js';
import { InsufficientPermissionsError } from '../errors/domain.errors.js';
import { PasswordHash } from '../value-objects/password-hash.vo.js';
import { UserId } from '../value-objects/user-id.vo.js';

export type UserRole = 'owner' | 'admin' | 'member';

export interface UserProps {
  id: UserId;
  name: string;
  email: Email;
  passwordHash: PasswordHash;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserProps {
  name: string;
  email: Email;
  passwordHash: PasswordHash;
  role?: UserRole;
}

export class User {
  private readonly props: UserProps;

  private constructor(props: UserProps) {
    this.props = props;
  }

  static create(input: CreateUserProps): User {
    const now = new Date();
    return new User({
      id: UserId.generate(),
      name: input.name.trim(),
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role ?? 'member',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  get id(): UserId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): Email {
    return this.props.email;
  }

  get passwordHash(): PasswordHash {
    return this.props.passwordHash;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateProfile(name: string): User {
    return User.reconstitute({
      ...this.props,
      name: name.trim(),
      updatedAt: new Date(),
    });
  }

  changePasswordHash(hash: PasswordHash): User {
    return User.reconstitute({
      ...this.props,
      passwordHash: hash,
      updatedAt: new Date(),
    });
  }

  deactivate(): User {
    return User.reconstitute({
      ...this.props,
      isActive: false,
      updatedAt: new Date(),
    });
  }

  canViewOtherProfiles(): boolean {
    return this.props.role === 'owner' || this.props.role === 'admin';
  }

  canChangeRoleOf(target: User): boolean {
    return this.props.role === 'owner' && !this.id.equals(target.id);
  }

  changeRole(newRole: UserRole, actor: User): User {
    if (!actor.canChangeRoleOf(this)) {
      throw new InsufficientPermissionsError();
    }
    return User.reconstitute({
      ...this.props,
      role: newRole,
      updatedAt: new Date(),
    });
  }

  toPlainObject(): Omit<UserProps, 'passwordHash'> & { passwordHash: string } {
    return {
      id: this.props.id,
      name: this.props.name,
      email: this.props.email,
      passwordHash: this.props.passwordHash.toString(),
      role: this.props.role,
      isActive: this.props.isActive,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
