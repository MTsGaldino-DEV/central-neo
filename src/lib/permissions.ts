import type { Role } from "./supabase";

export const MANAGER_ROLES: Role[] = ["ADMIN", "GESTOR", "SUPERVISOR"];
export const WRITE_ROLES: Role[] = ["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFADO"];

export function canManageUsers(role?: Role | null): boolean {
  return !!role && MANAGER_ROLES.includes(role);
}

export function isAdmin(role?: Role | null): boolean {
  return role === "ADMIN";
}

/** Cadastro de colaboradores: quem escreve no sistema, incluindo o almoxarifado. */
export function canManageColaboradores(role?: Role | null): boolean {
  return !!role && WRITE_ROLES.includes(role);
}

/** Aba "Recuperação de Dados": ADMIN e almoxarifado. */
export function canRecuperarDados(role?: Role | null): boolean {
  return role === "ADMIN" || role === "ALMOXARIFADO";
}

export function canWrite(role?: Role | null): boolean {
  return !!role && WRITE_ROLES.includes(role);
}

/** Passar por cima da trava de matrícula não cadastrada no import do GDIS. */
export function canForcarImportacao(role?: Role | null): boolean {
  return !!role && MANAGER_ROLES.includes(role);
}

export const roleLabels: Record<Role, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  SUPERVISOR: "Supervisor",
  ALMOXARIFADO: "Almoxarifado",
  DESPACHANTE: "Despachante",
};

export const assignableRoles: Role[] = ["GESTOR", "SUPERVISOR", "ALMOXARIFADO", "DESPACHANTE"];

// Todo usuário novo é criado com essa senha temporária; ele troca pela
// própria senha via "Primeiro acesso" na tela de login.
export const DEFAULT_PASSWORD = "123456";
