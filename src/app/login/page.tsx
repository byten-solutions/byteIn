"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loginSchema } from "@/modules/auth/auth.validation";
import { cn } from "@/lib/utils";

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [loading, setLoading] = useState(false);

  const validateField = (field: "email" | "password", value: string): string | undefined => {
    if (field === "email") {
      const trimmed = value.trim();
      if (!trimmed) return "Email is required";
      const res = loginSchema.shape.email.safeParse(trimmed);
      if (!res.success) {
        return res.error.issues[0]?.message || "Please enter a valid email address";
      }
    }
    if (field === "password") {
      if (!value) return "Password is required";
      const res = loginSchema.shape.password.safeParse(value);
      if (!res.success) {
        return res.error.issues[0]?.message || "Password is required";
      }
    }
    return undefined;
  };

  const handleBlur = (field: "email" | "password") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, field === "email" ? email : password);
    setFieldErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (error) setError(null);
    if (touched.email || fieldErrors.email) {
      const err = validateField("email", val);
      setFieldErrors((prev) => ({ ...prev, email: err }));
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (error) setError(null);
    if (touched.password || fieldErrors.password) {
      const err = validateField("password", val);
      setFieldErrors((prev) => ({ ...prev, password: err }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate using Zod schema
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0] as "email" | "password";
        if (path && !errors[path]) {
          errors[path] = issue.message;
        }
      }
      setFieldErrors(errors);
      setTouched({ email: true, password: true });
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });

      const data = await res.json();

      if (!res.ok) {
        // If server returned field validation errors in details
        if (data.details && Array.isArray(data.details)) {
          const sErrors: FieldErrors = {};
          for (const d of data.details) {
            const p = d.path?.[0] as "email" | "password";
            if (p) sErrors[p] = d.message;
          }
          if (Object.keys(sErrors).length > 0) {
            setFieldErrors(sErrors);
          }
        }
        throw new Error(data.error || "Failed to sign in");
      }

      if (data.user?.mustChangePassword) {
        router.push("/change-password");
        router.refresh();
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication error");
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = loading || (touched.email && !!fieldErrors.email) || (touched.password && !!fieldErrors.password);

  return (
    <div className="flex min-h-svh items-center justify-center p-4 sm:p-6 bg-background">
      <Card className="w-full max-w-sm rounded-2xl border border-border/80 bg-card shadow-sm my-auto">
        <CardHeader className="text-center space-y-2 pt-6 pb-2">
          <div className="flex justify-center mb-1">
            <Logo size={44} showWordmark={false} />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            Sign in to byteInn
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
          <CardContent className="space-y-4 px-6 pt-2 pb-6">
            {error && (
              <div
                role="alert"
                className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium flex items-start gap-2 animate-in fade-in-50"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                  Email
                </Label>
                {fieldErrors.email && (
                  <span className="text-[11px] text-destructive font-medium animate-in fade-in-50">
                    {fieldErrors.email}
                  </span>
                )}
              </div>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="reception@byteinn.local"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={() => handleBlur("email")}
                disabled={loading}
                aria-invalid={!!fieldErrors.email}
                className={cn(
                  "h-9 text-xs bg-background/50 border-border/80 transition-colors",
                  fieldErrors.email && "border-destructive focus-visible:ring-destructive/30"
                )}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                  Password
                </Label>
                {fieldErrors.password && (
                  <span className="text-[11px] text-destructive font-medium animate-in fade-in-50">
                    {fieldErrors.password}
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  onBlur={() => handleBlur("password")}
                  disabled={loading}
                  aria-invalid={!!fieldErrors.password}
                  className={cn(
                    "h-9 text-xs bg-background/50 border-border/80 pr-9 transition-colors",
                    fieldErrors.password && "border-destructive focus-visible:ring-destructive/30"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors p-0.5 rounded cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="px-6 py-4 border-t border-border/60 bg-muted/20">
            <Button
              type="submit"
              className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs font-semibold text-xs cursor-pointer transition-colors"
              disabled={isSubmitDisabled}
            >
              {loading ? "Signing in..." : "Sign in to Shift"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
