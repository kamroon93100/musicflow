"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signup } from "@/lib/auth/actions";

const signupSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type SignupValues = z.infer<typeof signupSchema>;

const inputClass =
  "rounded-md border border-border bg-card px-3 py-2 text-foreground " +
  "placeholder:text-muted-foreground outline-none transition-colors " +
  "focus:border-primary";

export default function SignupPage() {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  const onSubmit = (values: SignupValues) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signup(values);
      if (result?.error) setFormError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Create your account</h1>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted-foreground">Email</span>
        <input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass}
          {...register("email")}
        />
        {errors.email && (
          <span className="text-sm text-destructive" role="alert">
            {errors.email.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted-foreground">Password</span>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={inputClass}
          {...register("password")}
        />
        {errors.password && (
          <span className="text-sm text-destructive" role="alert">
            {errors.password.message}
          </span>
        )}
      </label>

      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity disabled:opacity-50"
      >
        {isPending ? "Creating account…" : "Sign up"}
      </button>

      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}