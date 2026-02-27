import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  const result: string = await bcrypt.hash(password, SALT_ROUNDS);
  return result;
}

export async function comparePasswords(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  const result: boolean = await bcrypt.compare(plainPassword, hashedPassword);
  return result;
}
