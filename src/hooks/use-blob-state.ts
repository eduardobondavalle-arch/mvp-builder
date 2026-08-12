import { useEffect, useState } from "react";

import { BlobState } from "@/lib/blob-state";

type ActiveField =
  | "none"
  | "email"
  | "password";

export function useBlobState(
  activeField: ActiveField,
) {
  const [state, setState] =
    useState<BlobState>("tracking");

  useEffect(() => {
    let timeout: number;

    /*
     * SENHA
     */
    if (activeField === "password") {
      setState("startled");

      timeout = window.setTimeout(() => {
        setState("respect");
      }, 280);

      return () => clearTimeout(timeout);
    }

    /*
     * EMAIL
     */
    if (activeField === "email") {
      setState("tracking");
      return undefined;
    }

    /*
     * NADA
     */
    setState("tracking");
    return undefined;
  }, [activeField]);

  return state;
}