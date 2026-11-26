import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getProfile, getUser } from "@/lib/auth/session";
import { SignupWizard } from "./signup-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("metaTitle") };
}

export default async function SignupPage() {
  const t = await getTranslations("auth.signup");
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  const loggedInName = user ? (profile?.fullName ?? user.email ?? "") : null;
  return (
    <div className="flex flex-col gap-4">
      <SignupWizard loggedInName={loggedInName} />
      {!user ? (
        <p className="text-center text-sm">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline dark:text-foreground">
            {t("login")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
