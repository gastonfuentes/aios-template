"use client";

/**
 * Tool — AI Elements vendored, rediseñado a estilo macOS 26 premium en PRP-032
 * iter v4 (post-cierre). Cambios respecto al vendored original:
 *
 *   - Outer wrapper con `aios-tool` class (rounded-xl + hairline DS + bg material-thin
 *     + transition border-color/shadow en hover/error).
 *   - Header trigger con `mc-interactive` motion canónico macOS + padding
 *     generoso px-4 py-3 + chevron rotation con curva macOS easeOut + truncate
 *     del tool name para evitar overflow en MCP names largos.
 *   - Status icon protagonista (en lugar de WrenchIcon estático) con icon
 *     premium lucide (Loader2 rotando, CheckCircle2 bounce, AlertCircle pulse).
 *   - Pill canónico macOS con color semántico `var(--sys-*)` del DS + animation
 *     por state (pending rotate, running rotate accent, completed bounce-in,
 *     error pulse).
 *   - Code blocks con bg `var(--fill-tertiary)` + hairline interno + radius 8px.
 *   - Labels h4 caption-1 más sutiles del DS macOS 26.
 *
 * `prefers-reduced-motion: reduce` global neutraliza las animations.
 * CSS keyframes + clases en `globals.css` bloque "Tool component (PRP-032 v4)".
 */

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/core/ui/collapsible";
import { cn } from "@/core/lib/utils";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  Loader2Icon,
  ShieldCheckIcon,
  ShieldQuestionIcon,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import { CodeBlock } from "./code-block";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("aios-tool group not-prose mb-4 w-full overflow-hidden", className)}
    {...props}
  />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "Awaiting approval",
  "approval-responded": "Responded",
  "input-available": "Running",
  "input-streaming": "Pending",
  "output-available": "Completed",
  "output-denied": "Denied",
  "output-error": "Error",
};

/**
 * Icono protagonista por state. Cada uno con su clase de animación canónica
 * que CSS aplica con keyframes macOS-flavored (rotate / bounce / pulse).
 */
const statusIcons: Record<ToolPart["state"], ReactNode> = {
  "approval-requested": (
    <ShieldQuestionIcon className="aios-tool-icon-state aios-tool-icon-approval-requested size-4" />
  ),
  "approval-responded": (
    <ShieldCheckIcon className="aios-tool-icon-state aios-tool-icon-approval-responded size-4" />
  ),
  "input-streaming": (
    <Loader2Icon className="aios-tool-icon-state aios-tool-icon-pending size-4" />
  ),
  "input-available": (
    <Loader2Icon className="aios-tool-icon-state aios-tool-icon-running size-4" />
  ),
  "output-available": (
    <CheckCircle2Icon className="aios-tool-icon-state aios-tool-icon-completed size-4" />
  ),
  "output-denied": (
    <XCircleIcon className="aios-tool-icon-state aios-tool-icon-denied size-4" />
  ),
  "output-error": (
    <AlertCircleIcon className="aios-tool-icon-state aios-tool-icon-error size-4" />
  ),
};

/**
 * Status pill canónico macOS — sustituye el `<Badge variant="secondary">`
 * shadcn gris por un pill con color semántico del DS (`var(--sys-*)`).
 * Background es color-mix 12% del color del state sobre transparent (patrón
 * canónico Apple para statuses sutiles tipo Console UI).
 */
export const getStatusBadge = (state: ToolPart["state"]) => (
  <span
    className={cn("aios-tool-status-pill", `aios-tool-status-pill-${state}`)}
    aria-label={statusLabels[state]}
  >
    {statusLabels[state]}
  </span>
);

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");

  return (
    <CollapsibleTrigger
      data-tool-state={state}
      className={cn(
        "aios-tool-header mc-interactive flex w-full items-center justify-between gap-3 px-4 py-3",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 text-sm">
        {statusIcons[state]}
        <span className="aios-tool-name truncate font-medium text-[color:var(--label-primary)]">
          {title ?? derivedName}
        </span>
        {getStatusBadge(state)}
      </div>
      <ChevronDownIcon
        className="aios-tool-chevron size-4 shrink-0 text-[color:var(--label-tertiary)]"
        aria-hidden
      />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "aios-tool-content space-y-3 px-4 pb-4 pt-1 outline-none",
      // Animations canónicas macOS via tailwindcss-animate; el `mc-overlay-in`
      // de globals.css sería ideal pero requiere refactor del Collapsible
      // Radix para usar custom animations. Por ahora mantenemos slide-in
      // que respeta `prefers-reduced-motion` global.
      "data-[state=closed]:animate-out data-[state=open]:animate-in",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1",
      "data-[state=closed]:duration-150 data-[state=open]:duration-220",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("aios-tool-section space-y-1.5 overflow-hidden", className)} {...props}>
    <h4 className="aios-tool-label">Parameters</h4>
    <div className="aios-tool-code">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  let Output = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = (
      <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
    );
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language="json" />;
  }

  return (
    <div className={cn("aios-tool-section space-y-1.5", className)} {...props}>
      <h4 className={cn("aios-tool-label", errorText && "aios-tool-label-error")}>
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "aios-tool-code overflow-x-auto text-xs [&_table]:w-full",
          errorText && "aios-tool-code-error"
        )}
      >
        {errorText && <div className="px-4 py-3 text-[color:var(--sys-red)]">{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
