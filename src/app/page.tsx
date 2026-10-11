import Link from "next/link";
import { getSession } from "@/lib/auth-guard";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function Page() {
  const session = await getSession();

  return (
    <div className="flex min-h-svh items-center justify-center p-6 bg-muted/20">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size={40} showWordmark={false} />
              <div>
                <CardTitle className="text-xl font-bold tracking-tight">
                  byteInn
                </CardTitle>
                <CardDescription className="text-xs">
                  Reception Room Management System
                </CardDescription>
              </div>
            </div>
            {session && <SignOutButton />}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {session ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Current Session
                  </span>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {session.role}
                  </span>
                </div>
                <div className="pt-1">
                  <p className="font-semibold text-base">{session.name}</p>
                  <p className="text-xs text-muted-foreground">{session.email}</p>
                </div>
              </div>

              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">
                  Phase 1 Complete: Authentication Active
                </p>
                <p>
                  You are authorized with the{" "}
                  <strong className="text-foreground">{session.role}</strong> role.
                  Protected API routes and session state are functional.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center py-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-base">Welcome to byteInn</h3>
                <p className="text-xs text-muted-foreground">
                  Please sign in with your staff account to access reception operations.
                </p>
              </div>
              <Link href="/login" className="block w-full">
                <Button className="w-full">Sign in to byteInn</Button>
              </Link>
            </div>
          )}

          <div className="pt-2 border-t font-mono text-[11px] text-muted-foreground text-center">
            (Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">d</kbd> to toggle dark mode)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
