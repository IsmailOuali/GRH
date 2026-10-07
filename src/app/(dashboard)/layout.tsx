import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getNotifications, getPendingCounts, getPendingReminders } from "@/lib/notifications";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { BottomTabBar } from "@/components/BottomTabBar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role ?? "EMPLOYEE";
  const name = session.user.name ?? "Utilisateur";

  // ADMIN and MANAGER must pick a company before entering the dashboard
  let activeCompany = session.user.company ?? "FAIRUP";
  if (role === "MANAGER" || role === "ADMIN") {
    const cookieStore = await cookies();
    const companyCookie = cookieStore.get("active_company")?.value;
    if (!companyCookie) redirect("/select-company");
    activeCompany = companyCookie;
  }

  const [counts, { items: notifications, unreadCount }, reminders] = await Promise.all([
    getPendingCounts(role, session.user.id, activeCompany),
    getNotifications(session.user.id),
    getPendingReminders(role, session.user.id, activeCompany),
  ]);

  return (
    // data-company re-points the --brand-* ramp declared in globals.css, so
    // every accent in the shell and the pages below follows the active space.
    <div data-company={activeCompany} className="flex min-h-screen bg-slate-50 dark:bg-black">
      {/* Lets keyboard users jump the whole nav — first stop on every page. */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Aller au contenu principal
      </a>

      <Sidebar
        role={role}
        name={name}
        company={activeCompany}
        counts={counts}
        notifications={notifications}
        unreadCount={unreadCount}
        reminders={reminders}
        className="hidden md:flex"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav
          role={role}
          name={name}
          company={activeCompany}
          counts={counts}
          notifications={notifications}
          unreadCount={unreadCount}
          reminders={reminders}
        />

        {/* The measure is owned here, once, so every route lines up with the
            next instead of each page picking its own max-width. */}
        <main
          id="contenu"
          className="flex-1 px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-8 md:py-8 md:pb-10"
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <BottomTabBar role={role} counts={counts} />
    </div>
  );
}
