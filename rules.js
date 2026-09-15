const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const formatPrice = (value) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

function outsideRangePercentage(price, low, high) {
  if (price >= low && price <= high) return 0;
  if (price > high) return ((price - high) / high) * 100;
  return ((low - price) / low) * 100;
}

export function calculateRisk(input) {
  const invoicePrice = Number(input.invoicePrice);
  const marketLow = Number(input.marketLow);
  const marketHigh = Number(input.marketHigh);
  const flags = [];
  const deviation = outsideRangePercentage(invoicePrice, marketLow, marketHigh);
  const suppliedRange = input.currency
    ? ` (${input.currency} ${formatPrice(marketLow)}–${formatPrice(marketHigh)} per ${input.unitOfMeasure || "unit"})`
    : "";

  if (deviation >= 100) {
    flags.push({
      id: "price-material",
      title: "Material price deviation",
      points: 25,
      detail: `The declared price is approximately ${Math.round(deviation)}% outside the supplied market range${suppliedRange}.`,
      action: "Obtain independent price evidence, product specifications and commercial rationale."
    });
  } else if (deviation >= 50) {
    flags.push({
      id: "price-significant",
      title: "Significant price deviation",
      points: 15,
      detail: `The declared price is approximately ${Math.round(deviation)}% outside the supplied market range${suppliedRange}.`,
      action: "Validate the benchmark, grade, quality, Incoterms and pricing rationale."
    });
  }

  if (input.relatedParty) {
    flags.push({
      id: "related-party",
      title: "Potential related-party transaction",
      points: 15,
      detail: "The buyer and seller may have a relationship that requires additional understanding.",
      action: "Confirm ownership, control, beneficial ownership and arm's-length pricing."
    });
  }

  if (input.thirdPartyPayment) {
    flags.push({
      id: "third-party-payment",
      title: "Third-party payment arrangement",
      points: 10,
      detail: "The payer may differ from the buyer or contractual counterparty.",
      action: "Establish the commercial purpose and documentary basis for the payment chain."
    });
  }

  if (input.routeMismatch) {
    flags.push({
      id: "route-anomaly",
      title: "Shipping route anomaly",
      points: 10,
      detail: "The selected route may not align with the expected commercial flow.",
      action: "Review ports, trans-shipment points, vessel details and the business rationale."
    });
  }

  if (input.documentMismatch) {
    flags.push({
      id: "document-mismatch",
      title: "Cross-document inconsistency",
      points: 15,
      detail: "Important values or descriptions may not align across the trade documents.",
      action: "Reconcile the LC, invoice, packing list, Bill of Lading and supporting documents."
    });
  }

  if (input.duplicateInvoice) {
    flags.push({
      id: "duplicate-invoice",
      title: "Potential duplicate invoice",
      points: 20,
      detail: "A similar invoice may have been used in another transaction.",
      action: "Search the internal trade record and confirm unique shipment and document identifiers."
    });
  }

  const score = clamp(flags.reduce((total, flag) => total + flag.points, 0), 0, 100);
  let band = "Low";
  if (score >= 75) band = "Critical";
  else if (score >= 50) band = "High";
  else if (score >= 25) band = "Medium";

  const recommendations = {
    Low: "Proceed with normal controls, while retaining the supporting documents and review rationale.",
    Medium: "Route the transaction for focused review and obtain additional evidence for the identified indicators.",
    High: "Place the transaction in an enhanced review queue before final processing or escalation.",
    Critical: "Pause routine processing and escalate for senior compliance review under the institution's approved procedure."
  };

  return {
    score,
    band,
    flags,
    deviation,
    recommendation: recommendations[band]
  };
}

export function bandClass(band) {
  return `status-${band.toLowerCase()}`;
}
