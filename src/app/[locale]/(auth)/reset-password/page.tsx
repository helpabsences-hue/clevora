import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title") };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");
  const user = await getUser();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
        {user ? <CardDescription>{t("subtitle", { email: user.email ?? "" })}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {user ? (
          <ResetPasswordForm />
        ) : (
          <div className="flex flex-col gap-4">
            <Alert variant="warning">{t("linkExpired")}</Alert>
            <Button asChild size="lg">
              <Link href="/forgot-password">{t("askAgain")}</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
