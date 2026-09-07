/** 角色權限：leader（隊長）與 teacher（老師）皆為最高權限 */
export function isStaff(role: string | undefined | null): boolean {
  return role === "leader" || role === "teacher";
}

export function roleLabelCn(role: string | undefined | null): string {
  return role === "leader" ? "隊長" : role === "teacher" ? "老師" : "隊員";
}
