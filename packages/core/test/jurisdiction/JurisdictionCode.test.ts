import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit } from "effect"
import * as Schema from "effect/Schema"
import {
  JurisdictionCode,
  isJurisdictionCode,
  US,
  GB,
  CA,
  AU,
  DE,
  FR,
  JP,
  CN,
  SG,
  HK,
  CH
} from "../../src/jurisdiction/JurisdictionCode.ts"

describe("JurisdictionCode", () => {
  describe("validation", () => {
    it.effect("accepts valid 2-letter uppercase country codes", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JurisdictionCode)

        const us = yield* decode("US")
        expect(us).toBe("US")

        const gb = yield* decode("GB")
        expect(gb).toBe("GB")

        const de = yield* decode("DE")
        expect(de).toBe("DE")

        const jp = yield* decode("JP")
        expect(jp).toBe("JP")
      })
    )

    it.effect("rejects lowercase country codes", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JurisdictionCode)
        const result = yield* Effect.exit(decode("us"))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects mixed case country codes", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JurisdictionCode)
        const result = yield* Effect.exit(decode("Us"))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects codes that are too short", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JurisdictionCode)
        const result = yield* Effect.exit(decode("U"))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects codes that are too long", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JurisdictionCode)
        const result = yield* Effect.exit(decode("USA"))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects codes with numbers", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JurisdictionCode)
        const result = yield* Effect.exit(decode("U1"))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects codes with special characters", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JurisdictionCode)
        const result = yield* Effect.exit(decode("U$"))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JurisdictionCode)
        const result = yield* Effect.exit(decode(""))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isJurisdictionCode returns true for valid codes", () => {
      expect(isJurisdictionCode("US")).toBe(true)
      expect(isJurisdictionCode("GB")).toBe(true)
      expect(isJurisdictionCode("DE")).toBe(true)
      expect(isJurisdictionCode("JP")).toBe(true)
      expect(isJurisdictionCode("XY")).toBe(true)
    })

    it("isJurisdictionCode returns false for invalid codes", () => {
      expect(isJurisdictionCode("us")).toBe(false)
      expect(isJurisdictionCode("U")).toBe(false)
      expect(isJurisdictionCode("USA")).toBe(false)
      expect(isJurisdictionCode("U1")).toBe(false)
      expect(isJurisdictionCode("")).toBe(false)
      expect(isJurisdictionCode(123)).toBe(false)
      expect(isJurisdictionCode(null)).toBe(false)
      expect(isJurisdictionCode(undefined)).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates JurisdictionCode using Schema's .make()", () => {
      const code = JurisdictionCode.make("US")
      expect(code).toBe("US")
    })
  })

  describe("predefined country codes", () => {
    it("US is defined correctly", () => {
      expect(US).toBe("US")
      expect(isJurisdictionCode(US)).toBe(true)
    })

    it("GB is defined correctly", () => {
      expect(GB).toBe("GB")
      expect(isJurisdictionCode(GB)).toBe(true)
    })

    it("CA is defined correctly", () => {
      expect(CA).toBe("CA")
      expect(isJurisdictionCode(CA)).toBe(true)
    })

    it("AU is defined correctly", () => {
      expect(AU).toBe("AU")
      expect(isJurisdictionCode(AU)).toBe(true)
    })

    it("DE is defined correctly", () => {
      expect(DE).toBe("DE")
      expect(isJurisdictionCode(DE)).toBe(true)
    })

    it("FR is defined correctly", () => {
      expect(FR).toBe("FR")
      expect(isJurisdictionCode(FR)).toBe(true)
    })

    it("JP is defined correctly", () => {
      expect(JP).toBe("JP")
      expect(isJurisdictionCode(JP)).toBe(true)
    })

    it("CN is defined correctly", () => {
      expect(CN).toBe("CN")
      expect(isJurisdictionCode(CN)).toBe(true)
    })

    it("SG is defined correctly", () => {
      expect(SG).toBe("SG")
      expect(isJurisdictionCode(SG)).toBe(true)
    })

    it("HK is defined correctly", () => {
      expect(HK).toBe("HK")
      expect(isJurisdictionCode(HK)).toBe(true)
    })

    it("CH is defined correctly", () => {
      expect(CH).toBe("CH")
      expect(isJurisdictionCode(CH)).toBe(true)
    })
  })

  describe("encoding", () => {
    it.effect("encodes JurisdictionCode back to string", () =>
      Effect.gen(function* () {
        const encode = Schema.encodeSync(JurisdictionCode)
        const decode = Schema.decodeUnknownSync(JurisdictionCode)

        const us = decode("US")
        const encoded = encode(us)

        expect(encoded).toBe("US")
      })
    )
  })
})
