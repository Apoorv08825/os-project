import { evaluatePassword } from "@/lib/password";

export function PasswordStrengthMeter({ password }: { password: string }) {
  const s = evaluatePassword(password);
  return (
    <div className="space-y-1.5">
      <div className="flex h-1.5 gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-full flex-1 rounded-full transition-colors ${
              i <= s.score ? s.color : "bg-muted"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{s.label}</span>
        <span className="text-muted-foreground">{s.feedback}</span>
      </div>
    </div>
  );
}
