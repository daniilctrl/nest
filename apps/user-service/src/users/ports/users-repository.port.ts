import { User } from '../entities/user.entity';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface CreateUserData {
  login: string;
  email: string;
  password: string;
  age: number;
  description: string;
  role?: User['role'];
  balance?: string;
  refreshToken?: string | null;
}

export interface FindUsersPaginatedParams {
  page: number;
  limit: number;
  login?: string;
}

export interface FindMostActiveUsersParams {
  ageMin: number;
  ageMax: number;
  page: number;
  limit: number;
  minActiveAvatars: number;
}

export interface UsersRepositoryPort {
  findById(id: string): Promise<User | null>;
  findByLogin(login: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  createAndSave(data: CreateUserData): Promise<User>;
  save(user: User): Promise<User>;
  saveMany(users: User[]): Promise<User[]>;
  updateById(id: string, patch: Partial<User>): Promise<void>;
  softDelete(user: User): Promise<void>;
  findPaginated(
    params: FindUsersPaginatedParams,
  ): Promise<{ data: User[]; total: number }>;
  findMostActive(
    params: FindMostActiveUsersParams,
  ): Promise<{ users: User[]; total: number }>;
  getByIdsForUpdate(ids: string[]): Promise<User[]>;
  resetBalancesForActiveUsers(): Promise<void>;
}
