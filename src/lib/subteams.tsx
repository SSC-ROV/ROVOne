"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { tt } from "./i18n-core";
import type { SubteamDef } from "./types";

export type SubteamWithLabel = SubteamDef & { label: string };

type Ctx = { subteams: SubteamWithLabel[] };

const SubteamCtx = createContext<Ctx>({ subteams: [] });

export function useSubteams(): Ctx {
  return useContext(SubteamCtx);
}

export default function SubteamsProvider({ children }: { children: React.ReactNode }) {
  const [subteams, setSubteams] = useState<SubteamWithLabel[]>([]);

  useEffect(() => {
    fetch("/api/subteams")
      .then((r) => r.json())
      .then((d) => {
        setSubteams(
          (d.subteams ?? []).map((x: SubteamDef) => ({
            ...x,
            get label() {
              return tt(x.zh, x.en);
            },
          }))
        );
      })
      .catch(() => {});
  }, []);

  return <SubteamCtx.Provider value={{ subteams }}>{children}</SubteamCtx.Provider>;
}
