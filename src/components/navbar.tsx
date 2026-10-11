import Link from "next/link";
import { getSession } from "@/lib/auth-guard";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";

export async function Navbar() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <Logo size={32} showWordmark={false} />
            <span className="font-bold tracking-tight text-base sm:text-lg">byteInn</span>
          </Link>

          {session && (
            <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Overview
              </Link>
              <Link
                href="/reservations"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Reservations
              </Link>
              <Link
                href="/rooms"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Rooms & Status
              </Link>
              <Link
                href="/categories"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Categories & Setup
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold leading-none">{session.name}</span>
                <span className="text-[11px] text-muted-foreground">{session.email}</span>
              </div>
              <Badge variant={session.role === "ADMIN" ? "default" : "secondary"} className="text-[11px]">
                {session.role}
              </Badge>
              <SignOutButton />
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
