"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type * as React from "react";
import { Input } from "@/components/ui/input";

export function PasswordInput(props: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const t = useTranslations("common");
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className="pe-12" {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute end-0 top-0 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
      </button>
    </div>
  );
}
