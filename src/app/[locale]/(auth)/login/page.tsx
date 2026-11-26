import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const sp = await searchParams;
  const t = await getTranslations("auth.login");
  const next = typeof sp.next === "string" ? sp.next : null;
  return (
    <div className="flex flex-col gap-4">
      {sp.expired ? <Alert variant="warning">{t("linkExpired")}</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} />
        </CardContent>
      </Card>
      <p className="text-center text-sm">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline dark:text-foreground">
          {t("createAgency")}
        </Link>
      </p>
    </div>
  );
}
