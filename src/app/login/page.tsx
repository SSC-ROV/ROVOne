import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "登入 · ROV 隊伍任務平台",
};

export default function LoginPage() {
  return <LoginForm />;
}
