import { describe, it, expect } from "vitest";
import { getDestinationImage, getRecommendationRationale } from "./destinationAssets";

describe("destinationAssets", () => {
  it("resolves specific images for known Karnataka destinations", () => {
    expect(getDestinationImage("hampi")).toBe("/images/hampi.jpg");
    expect(getDestinationImage("mysuru")).toBe("/images/mysuru.jpg");
    expect(getDestinationImage("coorg")).toBe("/images/coorg.jpg");
    expect(getDestinationImage("chikkamagaluru")).toBe("/images/chikkamagaluru.jpg");
    expect(getDestinationImage("badami")).toBe("/images/badami.jpg");
    expect(getDestinationImage("gokarna")).toBe("/images/gokarna.jpg");
    expect(getDestinationImage("bengaluru")).toBe("/images/bengaluru.jpg");
  });

  it("handles case insensitivity and region matching", () => {
    expect(getDestinationImage("Hampi-UNESCO")).toBe("/images/hampi.jpg");
    expect(getDestinationImage("Unknown-Hill", "Malnad & Western Ghats")).toBe("/images/chikkamagaluru.jpg");
    expect(getDestinationImage("Unknown-Coast", "Coastal Karnataka")).toBe("/images/gokarna.jpg");
  });

  it("provides recommendation rationales based on region and themes", () => {
    const rationale = getRecommendationRationale("Hampi", "UNESCO Heritage", ["heritage"]);
    expect(rationale).toContain("UNESCO World Heritage");

    const natureRationale = getRecommendationRationale("Coorg", "Coffee Country", ["nature"]);
    expect(natureRationale).toContain("coffee trails");
  });
});
