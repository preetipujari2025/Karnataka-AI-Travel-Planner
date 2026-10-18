import jsPDF from "jspdf";
import type {
  GenerateItineraryResponse,
  RoadTripPlanResponse,
  ScheduledItem,
  TripRequest,
} from "../api/types";
import { formatInr, formatDuration } from "./format";

export interface PDFExportOptions {
  filename?: string;
}

/**
 * Generates and triggers download of a polished, print-ready PDF itinerary
 * based strictly on the verified data returned by the backend.
 *
 * Adheres to:
 * - Clean multi-page layout with headers, footers and page numbering.
 * - Dynamic page breaking that prevents clipped cards or text overlapping.
 * - Exact backend budget breakdown (no recalculation or made-up numbers).
 * - Complete disclaimers for unverified entry fees and excluded costs.
 * - Strict exclusion of API keys or sensitive credentials.
 */
export async function generateItineraryPDF(
  plan: GenerateItineraryResponse,
  originalTrip?: TripRequest,
  options?: PDFExportOptions
): Promise<string> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2; // 182mm
  const bottomMargin = 20;

  let y = margin;

  // Colors
  const COLOR_PRIMARY_DARK = [15, 23, 42]; // #0f172a (Slate 900)
  const COLOR_SECONDARY_DARK = [30, 41, 59]; // #1e293b (Slate 800)
  const COLOR_GOLD = [217, 119, 6]; // #d97706 (Amber 600)
  const COLOR_GOLD_LIGHT = [254, 243, 199]; // #fef3c7 (Amber 100)
  const COLOR_TEXT_MUTED = [100, 116, 139]; // #64748b (Slate 500)
  const COLOR_CARD_BG = [248, 250, 252]; // #f8fafc (Slate 50)
  const COLOR_CARD_BORDER = [226, 232, 240]; // #e2e8f0 (Slate 200)

  // Page break tracker
  function ensureSpace(neededMm: number) {
    if (y + neededMm > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin + 8; // Extra breathing room on new pages
      renderSubsequentPageHeader();
    }
  }

  function renderSubsequentPageHeader() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
    doc.text("KARNATAKA TRAILS AI", margin, y - 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    const subheaderText = `${plan.budget.days}-Day Journey • Plan #${plan.plan_id.slice(0, 8)}`;
    doc.text(subheaderText, pageWidth - margin - doc.getTextWidth(subheaderText), y - 3);

    doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  }

  // ==========================================
  // 1. HERO HEADER BANNER
  // ==========================================
  const bannerHeight = 38;
  doc.setFillColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
  doc.roundedRect(margin, y, usableWidth, bannerHeight, 2, 2, "F");

  // Top accent bar inside banner
  doc.setFillColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.rect(margin, y, usableWidth, 2, "F");

  // Sub-brand label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(245, 158, 11); // Amber 500
  doc.text("KARNATAKA TRAILS AI  •  OFFICIAL ITINERARY", margin + 6, y + 9);

  // Source Badge on Top Right
  const sourceLabel =
    plan.source === "ai"
      ? `AI Personalized (${plan.ai_provider || "Model"})`
      : "Deterministic Verified Planner";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // Slate 300
  const sourceWidth = doc.getTextWidth(sourceLabel);
  doc.text(sourceLabel, pageWidth - margin - 6 - sourceWidth, y + 9);

  // Main Trip Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  const startCityName =
    plan.selected_destinations[0]?.name || originalTrip?.start_city || "Bengaluru";
  const tripTitle = `${plan.budget.days}-Day Karnataka Voyage: Starting from ${startCityName}`;
  doc.text(tripTitle, margin + 6, y + 19);

  // Plan Meta subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate 400
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const metaSubtitle = `Plan ID: #${plan.plan_id.slice(0, 8)}  |  Generated on ${dateStr}  |  Party: ${
    plan.budget.travellers
  } ${plan.budget.travellers === 1 ? "Traveller" : "Travellers"}  |  Tier: ${plan.budget.tier.toUpperCase()}`;
  doc.text(metaSubtitle, margin + 6, y + 27);

  // Subtle quote of destinations
  const routeNames = plan.selected_destinations.map((d) => d.name).join("  →  ");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(245, 158, 11);
  const truncatedRoute =
    doc.getTextWidth(routeNames) > usableWidth - 12
      ? doc.splitTextToSize(routeNames, usableWidth - 12)[0] + "..."
      : routeNames;
  doc.text(truncatedRoute, margin + 6, y + 33);

  y += bannerHeight + 5;

  // ==========================================
  // 2. TRIP SPECIFICATIONS & HIGHLIGHTS GRID
  // ==========================================
  ensureSpace(24);

  const totalDistanceKm = plan.route.reduce((sum, leg) => sum + leg.distance_km, 0);
  const totalTravelHours = plan.route.reduce((sum, leg) => sum + leg.duration_hours, 0);

  const specCards = [
    {
      title: "ORIGIN & REGION",
      main: startCityName,
      sub: plan.selected_destinations[0]?.region || "Karnataka",
    },
    {
      title: "DURATION & TRAVEL",
      main: `${plan.budget.days} Days / ${plan.budget.days - 1} N`,
      sub: `${plan.budget.travellers} Person(s)`,
    },
    {
      title: "ROAD TRANSIT",
      main: `${Math.round(totalDistanceKm)} km Highway`,
      sub: `~${formatDuration(totalTravelHours)} transit`,
    },
    {
      title: "BUDGET INVESTMENT",
      main: formatInr(plan.budget.total_inr),
      sub: `${formatInr(plan.budget.per_person_total_inr)} / person`,
    },
  ];

  const colWidth = (usableWidth - 3 * 3) / 4;
  specCards.forEach((card, idx) => {
    const cardX = margin + idx * (colWidth + 3);
    doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
    doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(cardX, y, colWidth, 18, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(card.title, cardX + 3, y + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
    doc.text(card.main, cardX + 3, y + 10.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(card.sub, cardX + 3, y + 15);
  });

  y += 22;

  // ==========================================
  // 3. EXECUTIVE SUMMARY & PREFERENCES
  // ==========================================
  ensureSpace(28);

  doc.setFillColor(COLOR_GOLD_LIGHT[0], COLOR_GOLD_LIGHT[1], COLOR_GOLD_LIGHT[2]);
  doc.setDrawColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.setLineWidth(0.4);

  const summaryLines = doc.splitTextToSize(plan.summary, usableWidth - 10);
  const summaryBoxHeight = 12 + summaryLines.length * 3.8;

  doc.roundedRect(margin, y, usableWidth, summaryBoxHeight, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.text("CURATED TRIP SUMMARY", margin + 5, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR_SECONDARY_DARK[0], COLOR_SECONDARY_DARK[1], COLOR_SECONDARY_DARK[2]);
  doc.text(summaryLines, margin + 5, y + 11);

  y += summaryBoxHeight + 5;

  // Preferences line
  ensureSpace(8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
  const interestsList = plan.interests.join(" • ").toUpperCase();
  const travelDatesInfo = originalTrip?.travel_dates
    ? `  |  DATES: ${originalTrip.travel_dates.start_date} to ${originalTrip.travel_dates.end_date}`
    : "";
  const transportPrefInfo = originalTrip?.transport_preference
    ? `  |  TRANSPORT: ${originalTrip.transport_preference.replace("_", " ").toUpperCase()}`
    : "";
  doc.text(
    `INTEREST FOCUS: ${interestsList}${travelDatesInfo}${transportPrefInfo}`,
    margin,
    y + 2
  );

  y += 6;

  // ==========================================
  // 4. HIGHWAY ROUTE SEQUENCE TABLE
  // ==========================================
  if (plan.route.length > 0) {
    ensureSpace(20 + plan.route.length * 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
    doc.text("Highway Route & Transit Estimates", margin, y + 2);
    y += 5;

    // Table Header
    doc.setFillColor(COLOR_SECONDARY_DARK[0], COLOR_SECONDARY_DARK[1], COLOR_SECONDARY_DARK[2]);
    doc.rect(margin, y, usableWidth, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text("LEG / STAGE", margin + 3, y + 4.2);
    doc.text("ORIGIN", margin + 30, y + 4.2);
    doc.text("DESTINATION", margin + 80, y + 4.2);
    doc.text("DISTANCE (KM)", margin + 130, y + 4.2);
    doc.text("EST. DURATION", margin + 158, y + 4.2);

    y += 6;

    plan.route.forEach((leg, index) => {
      ensureSpace(6);
      if (index % 2 === 0) {
        doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
        doc.rect(margin, y, usableWidth, 5.5, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);

      doc.text(`Stage ${index + 1} (Day ${leg.day})`, margin + 3, y + 3.8);
      doc.text(leg.origin.name, margin + 30, y + 3.8);
      doc.text(leg.destination.name, margin + 80, y + 3.8);
      doc.text(`${Math.round(leg.distance_km)} km`, margin + 130, y + 3.8);
      doc.text(formatDuration(leg.duration_hours), margin + 158, y + 3.8);

      y += 5.5;
    });

    y += 5;
  }

  // ==========================================
  // 5. DAY-BY-DAY ITINERARY TIMELINE
  // ==========================================
  ensureSpace(15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
  doc.text("Day-by-Day Comprehensive Schedule", margin, y);
  y += 5;

  plan.itinerary.forEach((dayPlan) => {
    // Estimate space needed for this day
    const narrativeLines = dayPlan.narrative
      ? doc.splitTextToSize(dayPlan.narrative, usableWidth - 12)
      : [];
    const activitiesCount = dayPlan.activities.length;
    const estDayHeight = 18 + narrativeLines.length * 3.5 + activitiesCount * 11 + 6;

    ensureSpace(Math.min(estDayHeight, 55)); // Ensure header + first couple items stay together

    // Day Header Bar
    doc.setFillColor(COLOR_SECONDARY_DARK[0], COLOR_SECONDARY_DARK[1], COLOR_SECONDARY_DARK[2]);
    doc.roundedRect(margin, y, usableWidth, 8, 1, 1, "F");

    // Left Day Badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(245, 158, 11);
    doc.text(`DAY ${dayPlan.day}`, margin + 4, y + 5.5);

    // Day Title / Stop Info
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    const stopTitle = dayPlan.day_title
      ? `${dayPlan.day_title} — ${dayPlan.place.name}`
      : `${dayPlan.place.name} (${dayPlan.place.region})`;
    doc.text(stopTitle, margin + 22, y + 5.5);

    // Stay info badge on right
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    const stayBadge =
      dayPlan.stay_days > 1
        ? `Stay ${dayPlan.stay_day} of ${dayPlan.stay_days}`
        : "Single Day Visit";
    const stayBadgeW = doc.getTextWidth(stayBadge);
    doc.text(stayBadge, pageWidth - margin - 4 - stayBadgeW, y + 5.5);

    y += 9.5;

    // Narrative paragraph (if present)
    if (dayPlan.narrative) {
      ensureSpace(narrativeLines.length * 3.5 + 4);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
      doc.text(narrativeLines, margin + 4, y + 3);
      y += narrativeLines.length * 3.5 + 3;
    }

    // Activities for the day
    dayPlan.activities.forEach((act) => {
      const actDescLines = doc.splitTextToSize(act.description, usableWidth - 38);
      const actHeight = 6 + actDescLines.length * 3.5;
      ensureSpace(actHeight + 2);

      // Light activity card
      doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
      doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
      doc.setLineWidth(0.2);
      doc.roundedRect(margin + 2, y, usableWidth - 4, actHeight, 1, 1, "FD");

      // Time Column
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
      doc.text(act.time || "Schedule", margin + 5, y + 4.2);

      // Activity Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
      doc.text(act.title, margin + 30, y + 4.2);

      // Kind label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
      const kindStr = act.kind.toUpperCase();
      const kindW = doc.getTextWidth(kindStr);
      doc.text(kindStr, pageWidth - margin - 6 - kindW, y + 4.2);

      // Activity Description
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(COLOR_SECONDARY_DARK[0], COLOR_SECONDARY_DARK[1], COLOR_SECONDARY_DARK[2]);
      doc.text(actDescLines, margin + 30, y + 8);

      y += actHeight + 2;
    });

    // Day travel tips if present
    if (dayPlan.travel_tips && dayPlan.travel_tips.length > 0) {
      dayPlan.travel_tips.forEach((tip) => {
        const tipLines = doc.splitTextToSize(`• Pro Tip: ${tip}`, usableWidth - 10);
        ensureSpace(tipLines.length * 3.2 + 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(180, 83, 9); // Amber 700
        doc.text(tipLines, margin + 4, y + 2.5);
        y += tipLines.length * 3.2 + 1;
      });
    }

    y += 4; // Space between days
  });

  // ==========================================
  // 6. COMPREHENSIVE ITEMIZED BUDGET BREAKDOWN
  // ==========================================
  ensureSpace(60);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
  doc.text("Itemized Investment & Cost Breakdown", margin, y);
  y += 5;

  // Budget Table Container
  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, usableWidth, 42, 1.5, 1.5, "FD");

  const budgetItems = [
    {
      category: "Accommodation & Dining",
      detail: `${plan.budget.days} Days / ${plan.budget.days - 1} Nights at ${plan.budget.tier} tier standard`,
      amount: formatInr(plan.budget.stay_food_inr),
    },
    {
      category: "Highway & Local Transit",
      detail: `Dedicated transport for ~${Math.round(totalDistanceKm)} km transit`,
      amount: formatInr(plan.budget.transport_inr),
    },
    {
      category: "Activities & Verified Sightseeing",
      detail: `Entry passes for verified stops (${plan.budget.estimate_complete ? "All stops verified" : "Partial verified"})`,
      amount: formatInr(plan.budget.activities_inr),
    },
  ];

  let budgetTableY = y + 5;
  budgetItems.forEach((row, idx) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
    doc.text(row.category, margin + 4, budgetTableY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(row.detail, margin + 4, budgetTableY + 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
    const amtW = doc.getTextWidth(row.amount);
    doc.text(row.amount, pageWidth - margin - 4 - amtW, budgetTableY + 2);

    if (idx < budgetItems.length - 1) {
      doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
      doc.setLineWidth(0.15);
      doc.line(margin + 4, budgetTableY + 7, pageWidth - margin - 4, budgetTableY + 7);
    }
    budgetTableY += 9;
  });

  // Total Summary Row inside Budget Box
  doc.setFillColor(COLOR_SECONDARY_DARK[0], COLOR_SECONDARY_DARK[1], COLOR_SECONDARY_DARK[2]);
  doc.roundedRect(margin + 2, y + 29, usableWidth - 4, 11, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL ESTIMATED TRIP COST", margin + 6, y + 36);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(245, 158, 11);
  const totalFormatted = formatInr(plan.budget.total_inr);
  const totalW = doc.getTextWidth(totalFormatted);
  doc.text(totalFormatted, pageWidth - margin - 6 - totalW, y + 36.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  const perPersonText = `(${formatInr(plan.budget.per_person_total_inr)} / traveller)`;
  doc.text(perPersonText, pageWidth - margin - 8 - totalW - doc.getTextWidth(perPersonText), y + 36.5);

  y += 46;

  // ==========================================
  // 7. HONEST PRICING & ENTRY FEE DISCLAIMER
  // ==========================================
  ensureSpace(28);

  doc.setFillColor(255, 251, 235); // Amber 50
  doc.setDrawColor(245, 158, 11); // Amber 500
  doc.setLineWidth(0.3);

  const disclaimerItems: string[] = [];

  if (plan.budget.unknown_entry_fees.length > 0) {
    disclaimerItems.push(
      `Unverified Entry Fees: Official fees for ${plan.budget.unknown_entry_fees.join(
        ", "
      )} could not be verified in official records and are excluded from the numeric total above.`
    );
  }

  if (plan.budget.zero_entry_fees.length > 0) {
    disclaimerItems.push(
      `Confirmed Free Entry: ${plan.budget.zero_entry_fees.join(", ")}.`
    );
  }

  if (plan.budget.excluded_costs_note) {
    disclaimerItems.push(`Scope note: ${plan.budget.excluded_costs_note}`);
  }

  disclaimerItems.push(
    "Local Estimate Guarantee: Totals reflect realistic seasonal tariff baselines. Personal shopping, optional guide fees, camera permits, and peak-season flight/train fares are not included."
  );

  const disclaimerText = disclaimerItems.join("\n\n");
  const disclaimerLines = doc.splitTextToSize(disclaimerText, usableWidth - 10);
  const disclaimerHeight = 9 + disclaimerLines.length * 3.4;

  doc.roundedRect(margin, y, usableWidth, disclaimerHeight, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9); // Amber 700
  doc.text("TRANSPARENCY & ENTRY FEE DISCLAIMER", margin + 4, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 53, 15); // Amber 900
  doc.text(disclaimerLines, margin + 4, y + 9);

  y += disclaimerHeight + 5;

  // ==========================================
  // 8. PRACTICAL TRAVEL TIPS & DESTINATION NOTES
  // ==========================================
  if (
    (plan.practical_tips && plan.practical_tips.length > 0) ||
    (plan.warnings && plan.warnings.length > 0)
  ) {
    ensureSpace(30);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
    doc.text("Essential Karnataka Travel Guidelines", margin, y);
    y += 5;

    // Warnings if any
    if (plan.warnings && plan.warnings.length > 0) {
      plan.warnings.forEach((warn) => {
        const warnLines = doc.splitTextToSize(`Important Notice: ${warn}`, usableWidth - 8);
        ensureSpace(warnLines.length * 3.4 + 3);

        doc.setFillColor(254, 242, 242); // Red 50
        doc.setDrawColor(239, 68, 68); // Red 500
        doc.setLineWidth(0.2);
        doc.roundedRect(margin, y, usableWidth, warnLines.length * 3.4 + 3, 1, 1, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(185, 28, 28); // Red 700
        doc.text(warnLines, margin + 4, y + 3.2);

        y += warnLines.length * 3.4 + 5;
      });
    }

    // Practical tips
    if (plan.practical_tips && plan.practical_tips.length > 0) {
      ensureSpace(12 + plan.practical_tips.length * 4);
      doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
      doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
      doc.setLineWidth(0.2);

      let tipsY = y;
      plan.practical_tips.forEach((tip) => {
        const tipLines = doc.splitTextToSize(`• ${tip}`, usableWidth - 8);
        ensureSpace(tipLines.length * 3.2 + 2);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(COLOR_SECONDARY_DARK[0], COLOR_SECONDARY_DARK[1], COLOR_SECONDARY_DARK[2]);
        doc.text(tipLines, margin + 4, tipsY + 3);
        tipsY += tipLines.length * 3.2 + 2;
      });
      y = tipsY + 4;
    }
  }

  // ==========================================
  // 9. FOOTER ON ALL PAGES
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Subtle divider
    doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    // Footer Left: Brand & Provenance
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(
      "Karnataka Trails AI  •  Verified Geodata & Distance Graph  •  Official Travel Itinerary",
      margin,
      pageHeight - 8
    );

    // Footer Center: Confidentiality / Disclaimer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(
      "Not an official reservation or booking ticket. Verify timings before travel.",
      margin,
      pageHeight - 4.5
    );

    // Footer Right: Page numbering
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
    const pageNumStr = `Page ${i} of ${totalPages}`;
    const pageNumW = doc.getTextWidth(pageNumStr);
    doc.text(pageNumStr, pageWidth - margin - pageNumW, pageHeight - 8);
  }

  // Generate clean filename
  const cleanStartCity = startCityName.replace(/[^a-zA-Z0-9]/g, "");
  const defaultFilename = `Karnataka-Trip-Itinerary-${plan.budget.days}Days-${cleanStartCity}.pdf`;
  const filename = options?.filename || defaultFilename;

  // Trigger download
  doc.save(filename);
  return filename;
}

const SCHEDULE_LABEL: Record<ScheduledItem["item_type"], string> = {
  departure: "DEPART",
  travel: "DRIVE",
  sightseeing: "VISIT",
  meal: "MEAL",
  rest: "REST",
  overnight: "STAY",
  arrival: "ARRIVE",
};

/**
 * Generates a print-ready PDF for a road-trip plan: real route facts,
 * day-by-day schedule with detours and meals, conflicts, and the exact
 * backend budget (minimum vs recommended). No numbers are recalculated
 * and nothing unverified is presented as certain.
 */
export async function generateRoadTripPDF(
  plan: RoadTripPlanResponse,
  options?: PDFExportOptions
): Promise<string> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const bottomMargin = 20;

  let y = margin;

  const COLOR_PRIMARY_DARK = [15, 23, 42];
  const COLOR_SECONDARY_DARK = [30, 41, 59];
  const COLOR_GOLD = [217, 119, 6];
  const COLOR_TEXT_MUTED = [100, 116, 139];
  const COLOR_CARD_BG = [248, 250, 252];
  const COLOR_CARD_BORDER = [226, 232, 240];

  function ensureSpace(neededMm: number) {
    if (y + neededMm > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin + 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
      doc.text("KARNATAKA TRAILS AI  •  ROAD TRIP PLAN", margin, y - 3);
      doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
    }
  }

  // ==========================================
  // 1. HERO BANNER
  // ==========================================
  const bannerHeight = 34;
  doc.setFillColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
  doc.roundedRect(margin, y, usableWidth, bannerHeight, 2, 2, "F");
  doc.setFillColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
  doc.rect(margin, y, usableWidth, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(245, 158, 11);
  doc.text("KARNATAKA TRAILS AI  •  ROAD TRIP ITINERARY", margin + 6, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  const routeSourceLabel = plan.route.verified
    ? `Live road route (${plan.route.provider ?? "OSRM"})`
    : "Estimated route corridor (provider unavailable)";
  const srcW = doc.getTextWidth(routeSourceLabel);
  doc.text(routeSourceLabel, pageWidth - margin - 6 - srcW, y + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(`${plan.route.origin.name}  →  ${plan.route.destination.name}`, margin + 6, y + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  const dateStr = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  doc.text(
    `Plan #${plan.plan_id.slice(0, 8)}  |  ${plan.days} Day${plan.days === 1 ? "" : "s"}  |  ${
      plan.budget.travellers
    } Traveller(s)  |  ${plan.budget.tier.toUpperCase()} tier  |  Generated ${dateStr}`,
    margin + 6,
    y + 26
  );

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(245, 158, 11);
  doc.text(
    `${Math.round(plan.route.distance_km)} km main route • ~${formatDuration(plan.route.duration_hours)} driving • ${plan.selected_stops.length} stops • ${plan.meal_stops.length} meal halts`,
    margin + 6,
    y + 31
  );
  y += bannerHeight + 6;

  // ==========================================
  // 2. BUDGET HEADLINE CARDS
  // ==========================================
  ensureSpace(26);
  const headlineCards = [
    {
      title: "MINIMUM PRACTICAL",
      main: plan.budget.minimum_total_inr != null ? formatInr(plan.budget.minimum_total_inr) : "—",
      sub: "without optional detours",
    },
    {
      title: "RECOMMENDED TOTAL",
      main: formatInr(plan.budget.total_inr),
      sub: `${formatInr(plan.budget.per_person_total_inr)} per person`,
    },
    {
      title: "MEALS + STAYS",
      main: formatInr(plan.budget.stay_food_inr + (plan.budget.meals_inr ?? 0)),
      sub: "tier-based estimates",
    },
    {
      title: "VERIFIED ENTRY FEES",
      main: formatInr(plan.budget.activities_inr),
      sub: plan.budget.estimate_complete ? "all stops verified" : "unknowns excluded",    },
  ];
  const colWidth = (usableWidth - 3 * 3) / 4;
  headlineCards.forEach((card, idx) => {
    const cardX = margin + idx * (colWidth + 3);
    doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
    doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(cardX, y, colWidth, 18, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(card.title, cardX + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
    doc.text(card.main, cardX + 3, y + 10.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(card.sub, cardX + 3, y + 15);
  });
  y += 22;

  // ==========================================
  // 3. DAY-BY-DAY SCHEDULE
  // ==========================================
  ensureSpace(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
  doc.text("Day-by-Day Road Schedule", margin, y);
  y += 5;

  plan.itinerary.forEach((dayPlan) => {
    const estDayHeight = 9 + dayPlan.schedule.length * 8.5 + dayPlan.notes.length * 3.4 + 4;
    ensureSpace(Math.min(estDayHeight, 55));

    doc.setFillColor(COLOR_SECONDARY_DARK[0], COLOR_SECONDARY_DARK[1], COLOR_SECONDARY_DARK[2]);
    doc.roundedRect(margin, y, usableWidth, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(245, 158, 11);
    doc.text(`DAY ${dayPlan.day}${dayPlan.date ? ` · ${dayPlan.date}` : ""}`, margin + 4, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    const dayRight = `Drive ~${Math.floor(dayPlan.driving_minutes / 60)}h ${dayPlan.driving_minutes % 60}m • Overnight: ${dayPlan.overnight_place.name}`;
    const rightW = doc.getTextWidth(dayRight);
    doc.text(dayRight, pageWidth - margin - 4 - rightW, y + 5.5);
    y += 9.5;

    dayPlan.schedule.forEach((item) => {
      const nameLines = doc.splitTextToSize(item.name, usableWidth - 60);
      const itemHeight = 4.5 + nameLines.length * 3.3;
      ensureSpace(itemHeight + 1.5);

      doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
      doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
      doc.setLineWidth(0.15);
      doc.roundedRect(margin + 2, y, usableWidth - 4, itemHeight, 0.8, 0.8, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(COLOR_GOLD[0], COLOR_GOLD[1], COLOR_GOLD[2]);
      doc.text(`${item.start_time}–${item.end_time}`, margin + 5, y + 3.6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
      doc.text(SCHEDULE_LABEL[item.item_type] ?? item.item_type.toUpperCase(), margin + 34, y + 3.6);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
      doc.text(nameLines, margin + 52, y + 3.6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
      const trail = `${item.detour_km != null && item.detour_km > 0 ? `+${item.detour_km.toFixed(1)}km detour · ` : ""}${item.duration_minutes}m`;
      const trailW = doc.getTextWidth(trail);
      doc.text(trail, pageWidth - margin - 6 - trailW, y + 3.6);

      y += itemHeight + 1.5;
    });

    dayPlan.notes.forEach((note) => {
      const noteLines = doc.splitTextToSize(`• ${note}`, usableWidth - 10);
      ensureSpace(noteLines.length * 3.2 + 1.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
      doc.text(noteLines, margin + 5, y + 2.4);
      y += noteLines.length * 3.2 + 1;
    });

    y += 3;
  });

  // ==========================================
  // 4. STOP & MEAL DETOUR TABLE
  // ==========================================
  if (plan.selected_stops.length > 0 || plan.meal_stops.length > 0) {
    ensureSpace(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
    doc.text("Selected Stops & Meal Halts (detour cost from the main road)", margin, y);
    y += 5;

    doc.setFillColor(COLOR_SECONDARY_DARK[0], COLOR_SECONDARY_DARK[1], COLOR_SECONDARY_DARK[2]);
    doc.rect(margin, y, usableWidth, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text("PLACE", margin + 3, y + 4.2);
    doc.text("TYPE", margin + 92, y + 4.2);
    doc.text("DETOUR", margin + 126, y + 4.2);
    doc.text("DATA STATUS", margin + 152, y + 4.2);
    y += 6;

    plan.selected_stops.forEach((stop, index) => {
      ensureSpace(5.5);
      if (index % 2 === 0) {
        doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
        doc.rect(margin, y, usableWidth, 5.5, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
      doc.text(stop.name.slice(0, 48), margin + 3, y + 3.8);
      doc.setFontSize(6.5);
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
      doc.text((stop.categories[0] ?? stop.source_kind).replace(/_/g, " ").slice(0, 16), margin + 92, y + 3.8);
      doc.text(
        `+${stop.detour_km.toFixed(1)} km${stop.detour_measured ? "" : " (est.)"}`,
        margin + 126,
        y + 3.8
      );
      doc.text(`fees: ${stop.entry_fee_status}`, margin + 152, y + 3.8);
      y += 5.5;
    });

    plan.meal_stops.forEach((meal) => {
      ensureSpace(5.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
      doc.text(meal.name.slice(0, 48), margin + 3, y + 3.8);
      doc.setFontSize(6.5);
      doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
      doc.text(`${meal.meal} · D${meal.day}`.slice(0, 16), margin + 92, y + 3.8);
      doc.text(`+${meal.detour_km.toFixed(1)} km`, margin + 126, y + 3.8);
      doc.text(`prices: ${meal.price_status}`, margin + 152, y + 3.8);
      y += 5.5;
    });

    y += 5;
  }

  // ==========================================
  // 5. CONFLICTS & REJECTED STOPS
  // ==========================================
  if (plan.rejected_stops.length > 0 || plan.conflicts.length > 0) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(185, 28, 28);
    doc.text("Scheduling Conflicts (reported honestly, never silently dropped)", margin, y);
    y += 5;

    plan.rejected_stops.forEach((stop) => {
      const lines = doc.splitTextToSize(`• ${stop.name}: ${stop.exclusion_reason}`, usableWidth - 8);
      ensureSpace(lines.length * 3.3 + 1.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(120, 53, 15);
      doc.text(lines, margin + 4, y + 2.6);
      y += lines.length * 3.3 + 1;
    });

    plan.conflicts.forEach((conflict) => {
      const lines = doc.splitTextToSize(`• ${conflict}`, usableWidth - 8);
      ensureSpace(lines.length * 3.3 + 1.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(120, 53, 15);
      doc.text(lines, margin + 4, y + 2.6);
      y += lines.length * 3.3 + 1;
    });

    y += 4;
  }

  // ==========================================
  // 6. BUDGET TABLE (EXACT BACKEND ARITHMETIC)
  // ==========================================
  ensureSpace(52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
  doc.text("Budget — Minimum vs Recommended", margin, y);
  y += 5;

  const budgetRows = [
    {
      category: "Main route transport",
      detail: `~${Math.round(plan.route.distance_km)} km, ${plan.route.verified ? "live routing distance" : "estimated distance"}`,
      amount: formatInr(plan.budget.transport_inr),
    },
    {
      category: "Optional stop detours",
      detail: `${plan.selected_stops.length} detour(s) beyond the main route`,
      amount: formatInr(plan.budget.detour_transport_inr ?? 0),
    },
    {
      category: "Stay & food at overnight places",
      detail: `${plan.budget.days - 1} night(s) at ${plan.budget.tier} tier`,
      amount: formatInr(plan.budget.stay_food_inr),
    },
    {
      category: "Meals on the road",
      detail: `${plan.meal_stops.length} planned meal halt(s)`,
      amount: formatInr(plan.budget.meals_inr ?? 0),
    },
    {
      category: "Verified entry fees",
      detail: plan.budget.unknown_entry_fees.length
        ? `excludes: ${plan.budget.unknown_entry_fees.join(", ")}`
        : "all selected stops have verified fees",
      amount: formatInr(plan.budget.activities_inr),
    },
  ];

  doc.setFillColor(COLOR_CARD_BG[0], COLOR_CARD_BG[1], COLOR_CARD_BG[2]);
  doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, usableWidth, 9 + budgetRows.length * 9, 1.5, 1.5, "FD");

  let budgetTableY = y + 5;
  budgetRows.forEach((row, idx) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
    doc.text(row.category, margin + 4, budgetTableY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(row.detail.slice(0, 110), margin + 4, budgetTableY + 3.6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
    const amtW = doc.getTextWidth(row.amount);
    doc.text(row.amount, pageWidth - margin - 4 - amtW, budgetTableY + 2);
    if (idx < budgetRows.length - 1) {
      doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
      doc.setLineWidth(0.15);
      doc.line(margin + 4, budgetTableY + 6, pageWidth - margin - 4, budgetTableY + 6);
    }
    budgetTableY += 9;
  });

  doc.setFillColor(COLOR_SECONDARY_DARK[0], COLOR_SECONDARY_DARK[1], COLOR_SECONDARY_DARK[2]);
  doc.roundedRect(margin + 2, y + 8 + budgetRows.length * 9 - 4, usableWidth - 4, 13, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("RECOMMENDED TOTAL", margin + 6, y + 13 + budgetRows.length * 9 - 4);
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(
    plan.budget.minimum_total_inr != null
      ? `Minimum practical (no optional detours): ${formatInr(plan.budget.minimum_total_inr)}`
      : "Minimum practical total unavailable (unknowns present)",
    margin + 6,
    y + 17.5 + budgetRows.length * 9 - 4
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(245, 158, 11);
  const totalFormatted = formatInr(plan.budget.total_inr);
  const totalW = doc.getTextWidth(totalFormatted);
  doc.text(totalFormatted, pageWidth - margin - 6 - totalW, y + 14 + budgetRows.length * 9 - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  const perPersonText = `(${formatInr(plan.budget.per_person_total_inr)} / traveller)`;
  doc.text(
    perPersonText,
    pageWidth - margin - 8 - totalW - doc.getTextWidth(perPersonText),
    y + 14 + budgetRows.length * 9 - 4
  );

  y += 13 + budgetRows.length * 9 + 4;

  // ==========================================
  // 7. ASSUMPTIONS, WARNINGS & ATTRIBUTION
  // ==========================================
  const notes: string[] = [
    ...(plan.budget.assumptions ?? []).map((a) => `Budget assumption: ${a}`),
    ...plan.assumptions.map((a) => `Plan assumption: ${a}`),
    ...plan.warnings.map((w) => `Warning: ${w}`),
    `Data providers: ${plan.providers.join(", ") || "curated local dataset"}.`,
    "Route geometry, distances and place data may originate from OSRM (routing) and OpenStreetMap via Overpass (© OpenStreetMap contributors, ODbL).",
  ];

  ensureSpace(14);
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.3);
  const notesHeight = 9 + notes.length * 3.4;
  doc.roundedRect(margin, y, usableWidth, notesHeight, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text("TRANSPARENCY NOTES & DATA ATTRIBUTION", margin + 4, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(120, 53, 15);
  const noteLines = doc.splitTextToSize(notes.map((n) => `• ${n}`).join("\n"), usableWidth - 8);
  doc.text(noteLines, margin + 4, y + 9);
  y += notesHeight + 5;

  // ==========================================
  // 8. FOOTERS ON ALL PAGES
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(COLOR_CARD_BORDER[0], COLOR_CARD_BORDER[1], COLOR_CARD_BORDER[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(COLOR_TEXT_MUTED[0], COLOR_TEXT_MUTED[1], COLOR_TEXT_MUTED[2]);
    doc.text(
      "Karnataka Trails AI  •  Route-Aware Road Trip Plan  •  Times & costs from verified data only",
      margin,
      pageHeight - 8
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(
      "Not a reservation. Verify opening hours, fees and restaurant availability before travelling.",
      margin,
      pageHeight - 4.5
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(COLOR_PRIMARY_DARK[0], COLOR_PRIMARY_DARK[1], COLOR_PRIMARY_DARK[2]);
    const pageNumStr = `Page ${i} of ${totalPages}`;
    const pageNumW = doc.getTextWidth(pageNumStr);
    doc.text(pageNumStr, pageWidth - margin - pageNumW, pageHeight - 8);
  }

  const cleanPair = `${plan.route.origin.name}-${plan.route.destination.name}`.replace(/[^a-zA-Z0-9]/g, "");
  const defaultFilename = `Karnataka-RoadTrip-${cleanPair}-${plan.days}Days.pdf`;
  const filename = options?.filename || defaultFilename;
  doc.save(filename);
  return filename;
}
