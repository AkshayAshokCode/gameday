import QRCode from "qrcode";

// Builds a UPI payment intent link. `amount` is omitted when unknown (e.g.
// the organizer hasn't set a cost_per_head) — most UPI apps just let the
// payer type it in manually in that case.
export function buildUpiLink(vpa: string, payeeName: string, amount: number | null, note: string) {
  const params = new URLSearchParams();
  params.set("pa", vpa);
  params.set("pn", payeeName);
  if (amount != null) params.set("am", amount.toFixed(2));
  params.set("cu", "INR");
  if (note) params.set("tn", note);
  return `upi://pay?${params.toString()}`;
}

export function generateUpiQr(upiLink: string): Promise<string> {
  return QRCode.toDataURL(upiLink);
}
