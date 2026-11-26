import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhone } from "@/lib/phone";
import { getProfile, requireUser } from "@/lib/auth/session";
import { PasswordForm, PreferencesForm, ProfileForm } from "./account-forms";
import { TwoFactorCard } from "./two-factor";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("title") };
}

export default async function AccountPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const t = await getTranslations("account");
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const mfaOn = Boolean(factors?.totp.some((f) => f.status === "verified"));
  return (
    <>
      <PageHeader title={t("title")} subtitle={user.email} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm fullName={profile?.fullName ?? ""} phone={formatPhone(profile?.phone)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("preferences.title")}</CardTitle>
            <CardDescription>{t("preferences.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <PreferencesForm locale={profile?.preferredLocale ?? "fr"} theme={profile?.preferredTheme ?? "system"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("password.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("mfa.title")}</CardTitle>
            <CardDescription>{t("mfa.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <TwoFactorCard enabled={mfaOn} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
