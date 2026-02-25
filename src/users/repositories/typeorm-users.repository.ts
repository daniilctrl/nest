import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Avatar } from '../../avatars/entities/avatar.entity';
import { User } from '../entities/user.entity';
import {
  CreateUserData,
  FindMostActiveUsersParams,
  FindUsersPaginatedParams,
  UsersRepositoryPort,
} from '../ports/users-repository.port';

@Injectable()
export class TypeOrmUsersRepository implements UsersRepositoryPort {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByLogin(login: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { login } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async createAndSave(data: CreateUserData): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }

  saveMany(users: User[]): Promise<User[]> {
    return this.usersRepository.save(users);
  }

  async updateById(id: string, patch: Partial<User>): Promise<void> {
    await this.usersRepository.update(id, patch);
  }

  async softDelete(user: User): Promise<void> {
    await this.usersRepository.softRemove(user);
  }

  async findPaginated(
    params: FindUsersPaginatedParams,
  ): Promise<{ data: User[]; total: number }> {
    const { page, limit, login } = params;
    const skip = (page - 1) * limit;
    const whereCondition = login ? { login: Like(`%${login}%`) } : {};

    const [data, total] = await this.usersRepository.findAndCount({
      where: whereCondition,
      take: limit,
      skip,
      order: { createdAt: 'DESC' },
    });

    return { data, total };
  }

  async findMostActive(
    params: FindMostActiveUsersParams,
  ): Promise<{ users: User[]; total: number }> {
    const { ageMin, ageMax, page, limit, minActiveAvatars } = params;
    const skip = (page - 1) * limit;

    const usersWithManyActiveAvatarsSubQuery = this.usersRepository.manager
      .createQueryBuilder(Avatar, 'a')
      .select('a.userId')
      .where('a.deletedAt IS NULL')
      .groupBy('a.userId')
      .having('COUNT(*) > :minActive', {
        minActive: minActiveAvatars,
      });

    const qb = this.usersRepository
      .createQueryBuilder('u')
      .where(`u.id IN (${usersWithManyActiveAvatarsSubQuery.getQuery()})`)
      .andWhere('TRIM(u.description) != :empty', { empty: '' })
      .andWhere('u.age >= :ageMin', { ageMin })
      .andWhere('u.age <= :ageMax', { ageMax })
      .andWhere('u.deletedAt IS NULL')
      .orderBy('u.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    qb.setParameters({
      ...qb.getParameters(),
      ...usersWithManyActiveAvatarsSubQuery.getParameters(),
    });

    const [users, total] = await qb.getManyAndCount();
    return { users, total };
  }

  async getByIdsForUpdate(ids: string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.usersRepository
      .createQueryBuilder('user')
      .setLock('pessimistic_write')
      .where('user.id IN (:...ids)', { ids })
      .orderBy('user.id', 'ASC')
      .getMany();
  }

  async resetBalancesForActiveUsers(): Promise<void> {
    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({ balance: '0.00' })
      .where('deletedAt IS NULL')
      .execute();
  }
}
