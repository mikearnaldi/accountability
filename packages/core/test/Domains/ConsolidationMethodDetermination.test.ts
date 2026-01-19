import { describe, it, expect } from "@effect/vitest"
import { FastCheck } from "effect"
import {
  determineMethod,
  determineMethodWithVIETracking,
  isMajorityOwnership,
  hasSignificantInfluence,
  hasNoSignificantInfluence,
  getVIEConsolidationMethod,
  FULL_CONSOLIDATION_THRESHOLD,
  EQUITY_METHOD_THRESHOLD
} from "../../src/consolidation/ConsolidationMethodDetermination.ts"
import { Percentage } from "../../src/shared/values/Percentage.ts"
import type { ConsolidationMethod } from "../../src/company/Company.ts"

describe("ConsolidationMethodDetermination", () => {
  describe("constants", () => {
    it("FULL_CONSOLIDATION_THRESHOLD is 50", () => {
      expect(FULL_CONSOLIDATION_THRESHOLD).toBe(50)
    })

    it("EQUITY_METHOD_THRESHOLD is 20", () => {
      expect(EQUITY_METHOD_THRESHOLD).toBe(20)
    })
  })

  describe("determineMethod", () => {
    describe("VIE primary beneficiary takes precedence", () => {
      it("returns FullConsolidation for VIE primary beneficiary with 0% ownership", () => {
        const result = determineMethod(Percentage.make(0), true)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for VIE primary beneficiary with 10% ownership", () => {
        const result = determineMethod(Percentage.make(10), true)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for VIE primary beneficiary with 15% ownership", () => {
        const result = determineMethod(Percentage.make(15), true)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for VIE primary beneficiary with 19.99% ownership", () => {
        const result = determineMethod(Percentage.make(19.99), true)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for VIE primary beneficiary with 20% ownership", () => {
        const result = determineMethod(Percentage.make(20), true)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for VIE primary beneficiary with 30% ownership", () => {
        const result = determineMethod(Percentage.make(30), true)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for VIE primary beneficiary with 50% ownership", () => {
        const result = determineMethod(Percentage.make(50), true)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for VIE primary beneficiary with 51% ownership", () => {
        const result = determineMethod(Percentage.make(51), true)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for VIE primary beneficiary with 80% ownership", () => {
        const result = determineMethod(Percentage.make(80), true)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for VIE primary beneficiary with 100% ownership", () => {
        const result = determineMethod(Percentage.make(100), true)
        expect(result).toBe("FullConsolidation")
      })
    })

    describe(">50% ownership → FullConsolidation", () => {
      it("returns FullConsolidation for 50.01% ownership", () => {
        const result = determineMethod(Percentage.make(50.01), false)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for 51% ownership", () => {
        const result = determineMethod(Percentage.make(51), false)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for 60% ownership", () => {
        const result = determineMethod(Percentage.make(60), false)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for 75% ownership", () => {
        const result = determineMethod(Percentage.make(75), false)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for 80% ownership", () => {
        const result = determineMethod(Percentage.make(80), false)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for 90% ownership", () => {
        const result = determineMethod(Percentage.make(90), false)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for 99% ownership", () => {
        const result = determineMethod(Percentage.make(99), false)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for 99.99% ownership", () => {
        const result = determineMethod(Percentage.make(99.99), false)
        expect(result).toBe("FullConsolidation")
      })

      it("returns FullConsolidation for 100% ownership", () => {
        const result = determineMethod(Percentage.make(100), false)
        expect(result).toBe("FullConsolidation")
      })
    })

    describe("20-50% ownership → EquityMethod", () => {
      it("returns EquityMethod for exactly 20% ownership", () => {
        const result = determineMethod(Percentage.make(20), false)
        expect(result).toBe("EquityMethod")
      })

      it("returns EquityMethod for 20.01% ownership", () => {
        const result = determineMethod(Percentage.make(20.01), false)
        expect(result).toBe("EquityMethod")
      })

      it("returns EquityMethod for 25% ownership", () => {
        const result = determineMethod(Percentage.make(25), false)
        expect(result).toBe("EquityMethod")
      })

      it("returns EquityMethod for 30% ownership", () => {
        const result = determineMethod(Percentage.make(30), false)
        expect(result).toBe("EquityMethod")
      })

      it("returns EquityMethod for 35% ownership", () => {
        const result = determineMethod(Percentage.make(35), false)
        expect(result).toBe("EquityMethod")
      })

      it("returns EquityMethod for 40% ownership", () => {
        const result = determineMethod(Percentage.make(40), false)
        expect(result).toBe("EquityMethod")
      })

      it("returns EquityMethod for 45% ownership", () => {
        const result = determineMethod(Percentage.make(45), false)
        expect(result).toBe("EquityMethod")
      })

      it("returns EquityMethod for 49% ownership", () => {
        const result = determineMethod(Percentage.make(49), false)
        expect(result).toBe("EquityMethod")
      })

      it("returns EquityMethod for 49.99% ownership", () => {
        const result = determineMethod(Percentage.make(49.99), false)
        expect(result).toBe("EquityMethod")
      })

      it("returns EquityMethod for exactly 50% ownership", () => {
        const result = determineMethod(Percentage.make(50), false)
        expect(result).toBe("EquityMethod")
      })
    })

    describe("<20% ownership → CostMethod", () => {
      it("returns CostMethod for 0% ownership", () => {
        const result = determineMethod(Percentage.make(0), false)
        expect(result).toBe("CostMethod")
      })

      it("returns CostMethod for 1% ownership", () => {
        const result = determineMethod(Percentage.make(1), false)
        expect(result).toBe("CostMethod")
      })

      it("returns CostMethod for 5% ownership", () => {
        const result = determineMethod(Percentage.make(5), false)
        expect(result).toBe("CostMethod")
      })

      it("returns CostMethod for 10% ownership", () => {
        const result = determineMethod(Percentage.make(10), false)
        expect(result).toBe("CostMethod")
      })

      it("returns CostMethod for 15% ownership", () => {
        const result = determineMethod(Percentage.make(15), false)
        expect(result).toBe("CostMethod")
      })

      it("returns CostMethod for 19% ownership", () => {
        const result = determineMethod(Percentage.make(19), false)
        expect(result).toBe("CostMethod")
      })

      it("returns CostMethod for 19.99% ownership", () => {
        const result = determineMethod(Percentage.make(19.99), false)
        expect(result).toBe("CostMethod")
      })
    })

    describe("boundary conditions", () => {
      it("exactly 20% is EquityMethod (boundary)", () => {
        expect(determineMethod(Percentage.make(20), false)).toBe("EquityMethod")
      })

      it("just under 20% is CostMethod (boundary)", () => {
        expect(determineMethod(Percentage.make(19.999999), false)).toBe("CostMethod")
      })

      it("exactly 50% is EquityMethod (boundary)", () => {
        expect(determineMethod(Percentage.make(50), false)).toBe("EquityMethod")
      })

      it("just over 50% is FullConsolidation (boundary)", () => {
        expect(determineMethod(Percentage.make(50.000001), false)).toBe("FullConsolidation")
      })
    })
  })

  describe("determineMethodWithVIETracking", () => {
    describe("VIE primary beneficiary returns VariableInterestEntity", () => {
      it("returns VariableInterestEntity for VIE primary beneficiary with 0% ownership", () => {
        const result = determineMethodWithVIETracking(Percentage.make(0), true)
        expect(result).toBe("VariableInterestEntity")
      })

      it("returns VariableInterestEntity for VIE primary beneficiary with 15% ownership", () => {
        const result = determineMethodWithVIETracking(Percentage.make(15), true)
        expect(result).toBe("VariableInterestEntity")
      })

      it("returns VariableInterestEntity for VIE primary beneficiary with 30% ownership", () => {
        const result = determineMethodWithVIETracking(Percentage.make(30), true)
        expect(result).toBe("VariableInterestEntity")
      })

      it("returns VariableInterestEntity for VIE primary beneficiary with 80% ownership", () => {
        const result = determineMethodWithVIETracking(Percentage.make(80), true)
        expect(result).toBe("VariableInterestEntity")
      })

      it("returns VariableInterestEntity for VIE primary beneficiary with 100% ownership", () => {
        const result = determineMethodWithVIETracking(Percentage.make(100), true)
        expect(result).toBe("VariableInterestEntity")
      })
    })

    describe("non-VIE uses standard ownership rules", () => {
      it("returns FullConsolidation for >50% ownership", () => {
        const result = determineMethodWithVIETracking(Percentage.make(75), false)
        expect(result).toBe("FullConsolidation")
      })

      it("returns EquityMethod for 20-50% ownership", () => {
        const result = determineMethodWithVIETracking(Percentage.make(35), false)
        expect(result).toBe("EquityMethod")
      })

      it("returns CostMethod for <20% ownership", () => {
        const result = determineMethodWithVIETracking(Percentage.make(10), false)
        expect(result).toBe("CostMethod")
      })
    })
  })

  describe("isMajorityOwnership", () => {
    it("returns true for >50% ownership", () => {
      expect(isMajorityOwnership(Percentage.make(51))).toBe(true)
      expect(isMajorityOwnership(Percentage.make(75))).toBe(true)
      expect(isMajorityOwnership(Percentage.make(100))).toBe(true)
    })

    it("returns false for exactly 50% ownership", () => {
      expect(isMajorityOwnership(Percentage.make(50))).toBe(false)
    })

    it("returns false for <50% ownership", () => {
      expect(isMajorityOwnership(Percentage.make(49))).toBe(false)
      expect(isMajorityOwnership(Percentage.make(30))).toBe(false)
      expect(isMajorityOwnership(Percentage.make(0))).toBe(false)
    })
  })

  describe("hasSignificantInfluence", () => {
    it("returns true for 20-50% ownership", () => {
      expect(hasSignificantInfluence(Percentage.make(20))).toBe(true)
      expect(hasSignificantInfluence(Percentage.make(35))).toBe(true)
      expect(hasSignificantInfluence(Percentage.make(50))).toBe(true)
    })

    it("returns false for <20% ownership", () => {
      expect(hasSignificantInfluence(Percentage.make(19))).toBe(false)
      expect(hasSignificantInfluence(Percentage.make(10))).toBe(false)
      expect(hasSignificantInfluence(Percentage.make(0))).toBe(false)
    })

    it("returns false for >50% ownership", () => {
      expect(hasSignificantInfluence(Percentage.make(51))).toBe(false)
      expect(hasSignificantInfluence(Percentage.make(75))).toBe(false)
      expect(hasSignificantInfluence(Percentage.make(100))).toBe(false)
    })
  })

  describe("hasNoSignificantInfluence", () => {
    it("returns true for <20% ownership", () => {
      expect(hasNoSignificantInfluence(Percentage.make(0))).toBe(true)
      expect(hasNoSignificantInfluence(Percentage.make(10))).toBe(true)
      expect(hasNoSignificantInfluence(Percentage.make(19))).toBe(true)
      expect(hasNoSignificantInfluence(Percentage.make(19.99))).toBe(true)
    })

    it("returns false for >=20% ownership", () => {
      expect(hasNoSignificantInfluence(Percentage.make(20))).toBe(false)
      expect(hasNoSignificantInfluence(Percentage.make(50))).toBe(false)
      expect(hasNoSignificantInfluence(Percentage.make(100))).toBe(false)
    })
  })

  describe("getVIEConsolidationMethod", () => {
    it("always returns FullConsolidation", () => {
      expect(getVIEConsolidationMethod()).toBe("FullConsolidation")
    })
  })

  describe("property-based tests", () => {
    const percentageArb = FastCheck.double({ min: 0, max: 100, noNaN: true }).map((n) =>
      Percentage.make(n)
    )

    it.prop(
      "VIE primary beneficiary always returns FullConsolidation",
      [percentageArb],
      ([pct]) => {
        const result = determineMethod(pct, true)
        return result === "FullConsolidation"
      }
    )

    it.prop(
      "VIE primary beneficiary with tracking always returns VariableInterestEntity",
      [percentageArb],
      ([pct]) => {
        const result = determineMethodWithVIETracking(pct, true)
        return result === "VariableInterestEntity"
      }
    )

    it.prop(
      "determineMethod always returns a valid ConsolidationMethod",
      [percentageArb, FastCheck.boolean()],
      ([pct, isVIE]) => {
        const result = determineMethod(pct, isVIE)
        const validMethods: ConsolidationMethod[] = [
          "FullConsolidation",
          "EquityMethod",
          "CostMethod",
          "VariableInterestEntity"
        ]
        return validMethods.includes(result)
      }
    )

    it.prop(
      "determineMethodWithVIETracking always returns a valid ConsolidationMethod",
      [percentageArb, FastCheck.boolean()],
      ([pct, isVIE]) => {
        const result = determineMethodWithVIETracking(pct, isVIE)
        const validMethods: ConsolidationMethod[] = [
          "FullConsolidation",
          "EquityMethod",
          "CostMethod",
          "VariableInterestEntity"
        ]
        return validMethods.includes(result)
      }
    )

    it.prop(
      ">50% ownership without VIE returns FullConsolidation",
      [FastCheck.double({ min: 50.0001, max: 100, noNaN: true })],
      ([pct]) => {
        const percentage = Percentage.make(pct)
        return determineMethod(percentage, false) === "FullConsolidation"
      }
    )

    it.prop(
      "20-50% ownership without VIE returns EquityMethod",
      [FastCheck.double({ min: 20, max: 50, noNaN: true })],
      ([pct]) => {
        const percentage = Percentage.make(pct)
        return determineMethod(percentage, false) === "EquityMethod"
      }
    )

    it.prop(
      "<20% ownership without VIE returns CostMethod",
      [FastCheck.double({ min: 0, max: 19.9999, noNaN: true })],
      ([pct]) => {
        const percentage = Percentage.make(pct)
        return determineMethod(percentage, false) === "CostMethod"
      }
    )

    it.prop(
      "isMajorityOwnership is true iff >50%",
      [percentageArb],
      ([pct]) => {
        const result = isMajorityOwnership(pct)
        return result === (pct > 50)
      }
    )

    it.prop(
      "hasSignificantInfluence is true iff 20-50%",
      [percentageArb],
      ([pct]) => {
        const result = hasSignificantInfluence(pct)
        return result === (pct >= 20 && pct <= 50)
      }
    )

    it.prop(
      "hasNoSignificantInfluence is true iff <20%",
      [percentageArb],
      ([pct]) => {
        const result = hasNoSignificantInfluence(pct)
        return result === (pct < 20)
      }
    )

    it.prop(
      "helper functions partition the percentage range completely (without VIE)",
      [percentageArb],
      ([pct]) => {
        // Exactly one of the three conditions should be true
        const majority = isMajorityOwnership(pct)
        const significant = hasSignificantInfluence(pct)
        const noInfluence = hasNoSignificantInfluence(pct)

        const count = [majority, significant, noInfluence].filter(Boolean).length
        return count === 1
      }
    )

    it.prop(
      "determineMethod and determineMethodWithVIETracking agree for non-VIE",
      [percentageArb],
      ([pct]) => {
        const result1 = determineMethod(pct, false)
        const result2 = determineMethodWithVIETracking(pct, false)
        return result1 === result2
      }
    )
  })

  describe("real-world scenarios", () => {
    it("wholly-owned subsidiary (100%)", () => {
      const result = determineMethod(Percentage.make(100), false)
      expect(result).toBe("FullConsolidation")
    })

    it("majority-controlled subsidiary (75%)", () => {
      const result = determineMethod(Percentage.make(75), false)
      expect(result).toBe("FullConsolidation")
    })

    it("joint venture (50%)", () => {
      const result = determineMethod(Percentage.make(50), false)
      expect(result).toBe("EquityMethod")
    })

    it("associate/affiliate (35%)", () => {
      const result = determineMethod(Percentage.make(35), false)
      expect(result).toBe("EquityMethod")
    })

    it("strategic minority investment (15%)", () => {
      const result = determineMethod(Percentage.make(15), false)
      expect(result).toBe("CostMethod")
    })

    it("small portfolio investment (5%)", () => {
      const result = determineMethod(Percentage.make(5), false)
      expect(result).toBe("CostMethod")
    })

    it("VIE special purpose entity with minimal ownership (10%)", () => {
      const result = determineMethod(Percentage.make(10), true)
      expect(result).toBe("FullConsolidation")
    })

    it("VIE real estate partnership with 25% interest", () => {
      const result = determineMethod(Percentage.make(25), true)
      expect(result).toBe("FullConsolidation")
    })

    it("VIE with disclosure tracking (15%)", () => {
      const result = determineMethodWithVIETracking(Percentage.make(15), true)
      expect(result).toBe("VariableInterestEntity")
    })
  })

  describe("ASC 810 compliance verification", () => {
    it("follows VOE model: >50% voting interest requires consolidation", () => {
      // Per ASC 810-10-15-8, controlling financial interest is typically
      // evidenced by >50% voting interest
      expect(determineMethod(Percentage.make(50.01), false)).toBe("FullConsolidation")
      expect(determineMethod(Percentage.make(51), false)).toBe("FullConsolidation")
    })

    it("follows VOE model: exactly 50% does not automatically require consolidation", () => {
      // 50% is a joint arrangement, not majority control
      expect(determineMethod(Percentage.make(50), false)).toBe("EquityMethod")
    })

    it("follows VIE model: primary beneficiary consolidates regardless of voting interest", () => {
      // Per ASC 810-10-25-38, the primary beneficiary must consolidate the VIE
      expect(determineMethod(Percentage.make(10), true)).toBe("FullConsolidation")
      expect(determineMethod(Percentage.make(0), true)).toBe("FullConsolidation")
    })

    it("equity method applies to significant influence (20-50%)", () => {
      // Per ASC 323-10-15-6, significant influence is typically 20-50%
      expect(determineMethod(Percentage.make(20), false)).toBe("EquityMethod")
      expect(determineMethod(Percentage.make(49), false)).toBe("EquityMethod")
    })

    it("cost method applies to no significant influence (<20%)", () => {
      // Per ASC 321, investments without significant influence
      expect(determineMethod(Percentage.make(19), false)).toBe("CostMethod")
      expect(determineMethod(Percentage.make(5), false)).toBe("CostMethod")
    })
  })
})
