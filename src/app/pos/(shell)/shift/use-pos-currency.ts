"use client";

// PE-10: the till's money is in the tenant's currency (INR or AUD). Shifts
// carry no currency of their own, so it is read from the POS menu, the one
// till endpoint that states it. Rupees until that answer lands.
import { useEffect, useState } from "react";
import { fetchMenu } from "../../api";

export function usePosCurrency(): string {
  const [currency, setCurrency] = useState("INR");
  useEffect(() => {
    let cancelled = false;
    fetchMenu()
      .then((menu) => {
        if (!cancelled && menu.currency) setCurrency(menu.currency);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return currency;
}
