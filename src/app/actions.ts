"use server";

import { sendDonationCopy } from "@/lib/email";
import { parseDbError } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { CatalogItem, Settings } from "@/lib/types";

export type SubmitInput = {
  name: string;
  email: string;
  phone: string;
  items: { item_id: number; quantity: number }[];
  website?: string; // honeypot: humanos não veem este campo
};

export type SubmitResult =
  | { ok: true; protocol: number; emailSent: boolean }
  | { ok: false; code: string; message: string; itemId?: number };

export async function submitDonation(input: SubmitInput): Promise<SubmitResult> {
  if (input.website) return { ok: true, protocol: 0, emailSent: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_donation", {
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone,
    p_items: input.items.filter((i) => i.quantity > 0),
  });

  if (error || !data?.[0]) {
    const e = parseDbError(error?.message);
    return { ok: false, ...e };
  }

  const protocol: number = data[0].protocol;

  const [{ data: catalog }, { data: settings }] = await Promise.all([
    supabase.rpc("get_catalog"),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);
  const byId = new Map((catalog as CatalogItem[] | null)?.map((c) => [c.id, c]) ?? []);
  const emailSent = await sendDonationCopy({
    to: input.email.trim(),
    name: input.name.trim(),
    protocol,
    settings: settings as Settings,
    lines: input.items
      .filter((i) => i.quantity > 0 && byId.has(i.item_id))
      .map((i) => ({
        name: byId.get(i.item_id)!.name,
        quantity: i.quantity,
        pix_price: byId.get(i.item_id)!.pix_price,
      })),
  });

  return { ok: true, protocol, emailSent };
}
