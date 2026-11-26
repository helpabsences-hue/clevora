import { SearchXIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <SearchXIcon className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("body")}</p>
      <Button asChild>
        <Link href="/dashboard">{t("back")}</Link>
      </Button>
    </main>
  );
}
