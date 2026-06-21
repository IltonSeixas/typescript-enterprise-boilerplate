import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { InsufficientPermissionsError, UserNotFoundError } from '../../domain/errors/domain.errors.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';
import { ListUsersDto, ListUsersOutputDto } from '../dtos/list-users.dto.js';
import { toUserOutput } from './register-user.use-case.js';

const DEFAULT_PAGE_SIZE = 20;

@injectable()
export class ListUsersUseCase {
  constructor(
    @inject('UserRepository') private readonly users: UserRepository,
  ) {}

  async execute(requesterId: string, input: ListUsersDto): Promise<ListUsersOutputDto> {
    const requester = await this.users.findById(UserId.create(requesterId));
    if (requester === null) {
      throw new UserNotFoundError();
    }
    if (!requester.canViewOtherProfiles()) {
      throw new InsufficientPermissionsError();
    }

    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const { items, total } = await this.users.findPaginated(offset, pageSize);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    return {
      items: items.map(toUserOutput),
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages,
      },
    };
  }
}
