export function getDestinationImage(destinationId: string, _region?: string): string {
  const id = destinationId.toLowerCase().trim();

  // Explicit matching: ONLY destinations with their own verified photo
  if (id.includes("bengaluru") || id.includes("bangalore")) {
    return "/images/bengaluru.jpg";
  }
  if (id.includes("mysuru") || id.includes("mysore")) {
    return "/images/mysuru.jpg";
  }
  if (id.includes("hampi")) {
    return "/images/hampi.jpg";
  }
  if (id.includes("badami")) {
    return "/images/badami.jpg";
  }
  if (id.includes("madikeri") || id.includes("coorg")) {
    return "/images/coorg.jpg";
  }
  if (id.includes("chikkamagaluru") || id.includes("chikmagalur")) {
    return "/images/chikkamagaluru.jpg";
  }
  if (id.includes("gokarna")) {
    return "/images/gokarna.jpg";
  }
  if (id.includes("jog-falls") || id.includes("jog_falls") || id.includes("jog")) {
    return "/images/jog_falls.jpg";
  }

  // All destinations without a dedicated matching photo use a neutral Karnataka landscape
  // NEVER use a photo of a different named place (e.g. Belagavi must never show Badami caves)
  return "/images/karnataka-neutral-landscape.jpg";
}

export function getRecommendationRationale(
  destinationId: string,
  region: string,
  categories: string[] = []
): string {
  const id = destinationId.toLowerCase();

  if (id.includes("hampi")) {
    return "Prioritized for UNESCO World Heritage ruins, monolithic stone architecture, and optimal sunset boulder viewpoints along the Tungabhadra.";
  }
  if (id.includes("badami")) {
    return "Selected for 6th-century Chalukyan rock-cut sandstone caves overlooking Agastya lake and ancient red canyon geology.";
  }
  if (id.includes("bengaluru")) {
    return "Designated starting hub with efficient highway connections, garden monuments, and regional transit infrastructure.";
  }
  if (id.includes("mysuru")) {
    return "Included for grand Wadiyar palace architecture, traditional markets, and seamless connectivity to Southern wildlife reserves.";
  }
  if (id.includes("srirangapatna")) {
    return "Selected as an island fortress stop on the Cauvery river, featuring historic sultanate fortifications, tombs, and riverside shrines.";
  }
  if (id.includes("coorg") || id.includes("madikeri")) {
    return "Curated for high-altitude estate homestays, misty coffee trails, Abbey Falls, and relaxed highland pacing.";
  }
  if (id.includes("chikkamagaluru")) {
    return "Chosen for Karnataka's highest peak (Mullayanagiri), cascading mountain streams, and historic coffee heritage.";
  }
  if (id.includes("gokarna")) {
    return "Selected for secluded Arabian Sea beach coves (Om Beach, Kudle), coastal cliff walks, and atmospheric seaside spirituality.";
  }
  if (id.includes("murudeshwar")) {
    return "Included for its iconic cliffside Shiva monument overlooking the sea and pristine coastal highway panoramas.";
  }
  if (id.includes("jog")) {
    return "Featured for India's monumental four-cascade plunge waterfall set within dense Western Ghats rainforest.";
  }
  if (id.includes("kabini") || id.includes("bandipur")) {
    return "Recommended for premier Nilgiri biosphere wildlife corridors, dawn boat safaris, and high leopard/elephant sighting frequency.";
  }

  const catStr = categories.join(", ");
  return `Curated in ${region} matching your selected themes (${catStr || "scenic heritage"}) with efficient driving proximity.`;
}
