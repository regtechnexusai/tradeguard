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

  const selectedIndicators = new Set(input.tbmlIndicators || []);
  const addManualIndicator = ({ key, id, title, points, detail, action, coveredBy }) => {
    if (!selectedIndicators.has(key)) return;
    if (coveredBy && coveredBy()) return;

    flags.push({
      id,
      title,
      points,
      detail,
      action,
      source: "Selected TBML indicator"
    });
  };

  addManualIndicator({
    key: "price-value-anomaly",
    id: "tbml-price-value-anomaly",
    title: "Reported price / valuation concern",
    points: 10,
    detail: "The supplied information indicates a possible price or valuation concern requiring supporting commercial evidence.",
    action: "Confirm the valuation basis, benchmark source, product grade, Incoterms and pricing rationale.",
    coveredBy: () => flags.some((flag) => flag.id.startsWith("price-"))
  });

  addManualIndicator({
    key: "goods-hs-mismatch",
    id: "tbml-goods-hs-mismatch",
    title: "Goods / HS Code mismatch concern",
    points: 15,
    detail: "The goods description, specification or classification may not align with the declared HS Code.",
    action: "Reconcile the HS Code with the goods, quality, composition, model and supporting commercial documents."
  });

  addManualIndicator({
    key: "quantity-unit-mismatch",
    id: "tbml-quantity-unit-mismatch",
    title: "Quantity / unit inconsistency",
    points: 10,
    detail: "The quantity or unit of measure may not align across the transaction information and supporting documents.",
    action: "Reconcile quantity, unit of measure, packing details and shipment records."
  });

  addManualIndicator({
    key: "document-inconsistency",
    id: "tbml-document-inconsistency",
    title: "Document inconsistency concern",
    points: 15,
    detail: "The invoice, packing list, Bill of Lading or related trade documents may contain inconsistent information.",
    action: "Obtain and reconcile the relevant documents before final processing.",
    coveredBy: () => flags.some((flag) => flag.id === "document-mismatch")
  });

  addManualIndicator({
    key: "route-port-anomaly",
    id: "tbml-route-port-anomaly",
    title: "Route / port anomaly concern",
    points: 10,
    detail: "The route, port, trans-shipment point or shipment pattern may require additional commercial explanation.",
    action: "Review the expected route, ports, vessel details, trans-shipment and business rationale.",
    coveredBy: () => flags.some((flag) => flag.id === "route-anomaly")
  });

  addManualIndicator({
    key: "related-party-ubo",
    id: "tbml-related-party-ubo",
    title: "Related-party / UBO concern",
    points: 15,
    detail: "Ownership, control, beneficial ownership or the relationship between the parties may require further understanding.",
    action: "Confirm ownership, control, beneficial ownership and arm's-length pricing.",
    coveredBy: () => flags.some((flag) => flag.id === "related-party")
  });

  addManualIndicator({
    key: "third-party-payment",
    id: "tbml-third-party-payment",
    title: "Third-party payment concern",
    points: 10,
    detail: "The payer may not be clearly linked to the buyer, seller or contractual purpose of the transaction.",
    action: "Establish the commercial purpose and documentary basis for the payment chain.",
    coveredBy: () => flags.some((flag) => flag.id === "third-party-payment")
  });

  addManualIndicator({
    key: "multiple-phantom-shipment",
    id: "tbml-multiple-phantom-shipment",
    title: "Multiple / phantom shipment concern",
    points: 20,
    detail: "The shipment or invoice may be repeated, unsupported or not sufficiently evidenced by goods movement.",
    action: "Check unique shipment identifiers, customs records, transport evidence and internal trade history."
  });

  addManualIndicator({
    key: "business-profile-mismatch",
    id: "tbml-business-profile-mismatch",
    title: "Business-profile mismatch",
    points: 10,
    detail: "The transaction may not align with the customer’s known business activity, capacity or expected trade pattern.",
    action: "Compare the transaction with the customer profile, capacity, past trade and stated business purpose."
  });

  addManualIndicator({
    key: "unusual-payment-terms",
    id: "tbml-unusual-payment-terms",
    title: "Unusual payment terms",
    points: 10,
    detail: "The payment structure may be unusual for the goods, counterparties or stated commercial rationale.",
    action: "Obtain the rationale, contractual basis and supporting approval for the payment terms."
  });

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
    selectedIndicatorCount: selectedIndicators.size,
    recommendation: recommendations[band]
  };
}

export function bandClass(band) {
  return `status-${band.toLowerCase()}`;
}
