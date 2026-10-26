export type CatalogItem = {
  id: number;
  category: string;
  name: string;
  limit_qty: number;
  pix_price: number | null;
  sort_order: number;
  active: boolean;
  committed: number;
  received: number;
  remaining: number;
};

export type Contact = { name: string; phone: string };

export type Settings = {
  form_open: boolean;
  closed_notice: "em_breve" | "encerrado";
  closes_at: string | null;
  delivery_deadline: string;
  delivery_place: string;
  morning_hours: string;
  afternoon_hours: string;
  pix_deadline: string;
  pix_key: string;
  contacts: Contact[];
  updated_at: string;
};

export type DonationItem = {
  id: string;
  donation_id: string;
  item_id: number;
  quantity: number;
  received: boolean;
  received_at: string | null;
  received_by: string | null;
};

export type Donation = {
  id: string;
  protocol: number;
  name: string;
  email: string;
  phone: string;
  status: "ativa" | "anulada";
  notes: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;
  donation_items: DonationItem[];
};

export type AuditEntry = {
  id: number;
  actor: string;
  action: string;
  donation_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};
