import { SignupForm } from "@/features/auth/components/signup-form";

export const SignUpPage = () => {
  return (
    <div className="app-shell-bg absolute inset-0 z-0 flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <SignupForm />
      </div>
    </div>
  );
};
