import Link from "next/link";
import { BottomNav, TopNav } from "@/components/Nav";
import { requireUserId } from "@/lib/dal";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUserId();
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/people" className="text-lg font-bold tracking-tight text-teal-800">
            People
          </Link>
          <TopNav />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-5 pb-28 sm:pb-12">{children}</main>
      <BottomNav />
    </>
  );
}
