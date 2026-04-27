import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "./Card";

interface ResultPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: React.ReactNode;
  tone?: "neutral" | "success";
  children: React.ReactNode;
}

export function ResultPanel({
  title,
  description,
  tone = "neutral",
  children,
  className,
  ...props
}: ResultPanelProps) {
  return (
    <Card
      className={cn(
        tone === "success" && "border-green-200 dark:border-green-900/50",
        className,
      )}
      {...props}
    >
      {(title || description) && (
        <CardHeader>
          {title ? (
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          ) : null}
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
