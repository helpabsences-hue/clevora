import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.forgot");
  return { title: t("title") };
}

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/[locale]/forgot-password">) {
  const sp = await searchParams;
  const t = await getTranslations("auth.forgot");
  return (
    <div className="flex flex-col gap-4">
      {sp.expired ? <Alert variant="warning">{t("linkExpired")}</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
      <p className="text-center text-sm">
        <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline dark:text-foreground">
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
