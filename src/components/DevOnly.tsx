import type { ReactNode } from "react";

interface Props {
  isDev: boolean;
  children: ReactNode;
  /** Show a labelled border in dev mode so you know the feature is dev-only */
  label?: string;
}

/**
 * Renders children only when the logged-in user has is_dev=true on their profile.
 * Usage:
 *   <DevOnly isDev={profile.is_dev}>
 *     <MyExperimentalFeature />
 *   </DevOnly>
 */
export default function DevOnly({ isDev, children, label }: Props) {
  if (!isDev) return null;
  if (!label) return <>{children}</>;

  return (
    <div className="relative border-2 border-dashed border-purple-400 rounded-xl">
      <span className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs font-semibold text-purple-500 tracking-wide">
        DEV: {label}
      </span>
      {children}
    </div>
  );
}
