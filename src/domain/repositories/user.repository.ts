import { User } from '../entities/user.entity.js';
import { Email } from '../value-objects/email.vo.js';
import { UserId } from '../value-objects/user-id.vo.js';

export interface PaginatedUsers {
  items: User[];
  total: number;
}

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  saveFirstOwner(user: User): Promise<void>;
  hasOwner(): Promise<boolean>;
  findPaginated(offset: number, limit: number): Promise<PaginatedUsers>;
}
