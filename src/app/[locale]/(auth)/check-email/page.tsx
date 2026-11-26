import { MailCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.checkEmail");
  return { title: t("title") };
}

export default async function CheckEmailPage({ searchParams }: PageProps<"/[locale]/check-email">) {
  const sp = await searchParams;
  const t = await getTranslations("auth.checkEmail");
  const email = typeof sp.email === "string" ? sp.email : "";
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 pt-6 text-center sm:pt-8">
        <MailCheckIcon className="size-12 text-success" aria-hidden />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body", { email })}</p>
        <p className="text-sm text-muted-foreground">{t("spam")}</p>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
