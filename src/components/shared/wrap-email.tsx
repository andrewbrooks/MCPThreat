import * as React from "react";

/** Show an email or an owner label so it can only wrap after the "@", never mid-word. */
export function WrapEmail({ value }: { value: string }) {
  const at = value.indexOf("@");
  if (at < 1) return <>{value}</>;
  return (
    <>
      {value.slice(0, at + 1)}
      <wbr />
      {value.slice(at + 1)}
    </>
  );
}
