import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MfaForm } from "./mfa-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.mfa");
  return { title: t("title") };
}

/** Second step of the login (the proxy sends people here until the code is entered). */
export default async function MfaPage({ searchParams }: PageProps<"/[locale]/mfa">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : null;
  const t = await getTranslations("auth.mfa");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <MfaForm next={next} />
      </CardContent>
    </Card>
  );
}
