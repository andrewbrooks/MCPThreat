"use client";

import * as React from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard and screen-reader behaviour for modal surfaces (Dialog, Drawer): moves
 * focus inside on open, keeps Tab within the surface, labels it from its first
 * heading, and returns focus to the control that opened it on close.
 */
export function useModal(open: boolean, ref: React.RefObject<HTMLElement>) {
  React.useEffect(() => {
    if (!open) return;
    const node = ref.current;
    if (!node) return;
    const opener = document.activeElement as HTMLElement | null;

    const heading = node.querySelector("h2");
    if (heading) {
      if (!heading.id) heading.id = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
      node.setAttribute("aria-labelledby", heading.id);
    }

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
    // Prefer the first form field over the close button.
    const first =
      focusables().find((el) => el.getAttribute("aria-label") !== "Close") ?? focusables()[0];
    (first ?? node).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, ref]);
}
