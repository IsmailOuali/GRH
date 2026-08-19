import bcrypt from "bcryptjs";

/**
 * Temporary in-memory user store for the runnable skeleton.
 * Passwords are hashed at module load so authorize() uses bcrypt.compare,
 * exactly like the real flow will.
 *
 * SWAP LATER: replace getUserByEmail() with a Prisma query
 * (`prisma.user.findUnique`) per REBUILD_TECHNICAL.md. Nothing else changes.
 */
export type StoredUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "EMPLOYEE" | "MANAGER" | "ADMIN";
  position?: string;
};

const RAW_USERS: Array<Omit<StoredUser, "passwordHash"> & { password: string }> = [
  { id: "u-admin", name: "Sophie Martin", email: "admin@fairup.fr", password: "admin123", role: "ADMIN", position: "Directrice RH" },
  { id: "u-mgr-1", name: "Jean Dupont", email: "manager1@fairup.fr", password: "manager123", role: "MANAGER", position: "Responsable d'équipe" },
  { id: "u-mgr-2", name: "Claire Bernard", email: "manager2@fairup.fr", password: "manager123", role: "MANAGER", position: "Responsable d'équipe" },
  { id: "u-emp-1", name: "Thomas Petit", email: "emp1@fairup.fr", password: "emp123", role: "EMPLOYEE", position: "Développeur" },
  { id: "u-emp-2", name: "Marie Lambert", email: "emp2@fairup.fr", password: "emp123", role: "EMPLOYEE", position: "Comptable" },
  { id: "u-emp-3", name: "Nicolas Roux", email: "emp3@fairup.fr", password: "emp123", role: "EMPLOYEE", position: "Commercial" },
];

const USERS: StoredUser[] = RAW_USERS.map(({ password, ...u }) => ({
  ...u,
  passwordHash: bcrypt.hashSync(password, 10),
}));

export function getUserByEmail(email: string): StoredUser | undefined {
  return USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}
