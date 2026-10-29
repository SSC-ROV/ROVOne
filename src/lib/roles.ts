import { tt } from "./i18n-core";

/** 角色權限：leader（隊長）與 teacher（老師）皆為最高權限 */
export function isStaff(role: string | undefined | null): boolean {
  return role === "leader" || role === "teacher";
}

export function roleLabelCn(role: string | undefined | null): string {
  if (role === "leader") return tt("隊長", "Leader");
  if (role === "teacher") return tt("老師", "Teacher");
  return tt("隊員", "Member");
}
