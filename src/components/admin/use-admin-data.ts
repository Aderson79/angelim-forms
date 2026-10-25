"use client";

import { parseDbError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { CatalogItem, Donation } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

const PAGE = 1000; // limite padrão de linhas por requisição do Supabase

async function fetchAllDonations() {
  const supabase = createClient();
  const all: Donation[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("donations")
      .select("*, donation_items(*)")
      .order("protocol", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data as Donation[]));
    if (data.length < PAGE) return all;
  }
}

export function useAdminData() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [{ data: cat, error: catErr }, dons] = await Promise.all([
        createClient().rpc("get_catalog"),
        fetchAllDonations(),
      ]);
      if (catErr) throw catErr;
      setCatalog(cat as CatalogItem[]);
      setDonations(dons);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial assíncrona
    reload();
  }, [reload]);

  return { catalog, donations, loaded, error, reload };
}

/** Chama uma função admin do banco. Retorna a mensagem de erro amigável, ou null. */
export async function adminRpc(fn: string, args: Record<string, unknown>) {
  const { error } = await createClient().rpc(fn, args);
  if (!error) return null;
  const e = parseDbError(error.message);
  return e.message;
}

/** Mapa de telefone/e-mail que aparecem em mais de uma doação ativa. */
export function findDuplicates(donations: Donation[]) {
  const count = new Map<string, number>();
  for (const d of donations) {
    if (d.status !== "ativa") continue;
    for (const key of [`p:${d.phone.replace(/\D/g, "")}`, `e:${d.email.toLowerCase()}`]) {
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }
  return (d: Donation) =>
    d.status === "ativa" &&
    ((count.get(`p:${d.phone.replace(/\D/g, "")}`) ?? 0) > 1 ||
      (count.get(`e:${d.email.toLowerCase()}`) ?? 0) > 1);
}
