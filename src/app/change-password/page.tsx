"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError("Please enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError("New password must contain at least one uppercase letter.");
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      setError("New password must contain at least one lowercase letter.");
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError("New password must contain at least one number.");
      return;
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) {
      setError("New password must contain at least one special character.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password cannot be the same as your current password.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <Logo size={44} showWordmark={false} />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password. All other active sessions will be signed out.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div
                role="alert"
                className="p-3 text-sm rounded-md bg-destructive/15 text-destructive font-medium border border-destructive/20"
              >
                {error}
              </div>
            )}
            {success && (
              <div
                role="alert"
                className="p-3 text-sm rounded-md bg-emerald-50 text-emerald-800 font-medium border border-emerald-200"
              >
                Password updated successfully! Redirecting to dashboard...
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading || success}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading || success}
                placeholder="At least 8 chars, 1 uppercase, 1 symbol"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || success}
                placeholder="Re-enter new password"
              />
            </div>
          </CardContent>
          <CardFooter className="pt-2 flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={loading || success}>
              {loading ? "Updating Password..." : "Update Password"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              disabled={loading || success}
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
