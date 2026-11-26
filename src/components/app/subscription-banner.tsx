import { CircleAlertIcon, LockIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import type { Role } from "@/lib/auth/session";
import type { SubscriptionState } from "@/lib/subscription";

/** Payment late, or the read-only explanation with a link to billing (admins). */
export async function SubscriptionBanner({ subscription, role }: { subscription: SubscriptionState; role: Role }) {
  const t = await getTranslations("app.subscription");
  if (subscription.reason === "active") return null;

  const billingLink =
    role === "admin" ? (
      <Link href="/billing" className="inline-flex min-h-11 items-center font-semibold whitespace-nowrap underline underline-offset-4">
        {t("choosePlan")}
      </Link>
    ) : (
      <span className="text-muted-foreground">{t("askAdmin")}</span>
    );

  // The free trial is not announced on every page (Abonnement shows the days left).
  if (subscription.reason === "trial") return null;

  if (subscription.reason === "past_due") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pt-4">
        <Alert variant="warning" className="flex-wrap items-center py-2">
          <CircleAlertIcon aria-hidden />
          <span className="flex-1">{t("pastDue")}</span>
          {billingLink}
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4">
      <Alert variant="danger" data-testid="readonly-banner" className="flex-wrap items-center">
        <LockIcon aria-hidden />
        <span className="flex flex-1 flex-col gap-0.5">
          <strong>{t(`readOnly.${subscription.reason}`)}</strong>
          <span>{t("readOnlyBody")}</span>
        </span>
        {billingLink}
      </Alert>
    </div>
  );
}
