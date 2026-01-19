import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  StatusTransition,
  isStatusTransition,
  TransitionAction,
  isTransitionAction,
  allowedTransitions,
  internalTransitions,
  allTransitions,
  InvalidStatusTransitionError,
  isInvalidStatusTransitionError,
  canTransition,
  canTransitionViaReversal,
  canTransitionIncludingInternal,
  getTransitionDescription,
  getAllowedTransitionsFrom,
  getTransitionAction,
  validateTransition,
  validateTransitionIncludingInternal,
  getNextStatus,
  isActionValidForStatus,
  getValidActionsForStatus,
  getUserActionsForStatus,
  isTerminalStatus,
  isEditableStatus,
  isDeletableStatus
} from "../../src/journal/EntryStatusWorkflow.ts"
import type { JournalEntryStatus } from "../../src/journal/JournalEntry.ts"

describe("StatusTransition", () => {
  describe("creation", () => {
    it("creates a valid status transition", () => {
      const transition = StatusTransition.make({
        from: "Draft",
        to: "PendingApproval",
        description: "Submit for approval"
      })
      expect(transition.from).toBe("Draft")
      expect(transition.to).toBe("PendingApproval")
      expect(transition.description).toBe("Submit for approval")
    })

    it("creates transitions for all status pairs", () => {
      const statuses: JournalEntryStatus[] = [
        "Draft",
        "PendingApproval",
        "Approved",
        "Posted",
        "Reversed"
      ]

      for (const from of statuses) {
        for (const to of statuses) {
          const transition = StatusTransition.make({
            from,
            to,
            description: `${from} to ${to}`
          })
          expect(transition.from).toBe(from)
          expect(transition.to).toBe(to)
        }
      }
    })
  })

  describe("validation", () => {
    it.effect("rejects invalid from status", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(StatusTransition)
        const result = yield* Effect.exit(decode({
          from: "InvalidStatus",
          to: "Draft",
          description: "Test"
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid to status", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(StatusTransition)
        const result = yield* Effect.exit(decode({
          from: "Draft",
          to: "InvalidStatus",
          description: "Test"
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty description", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(StatusTransition)
        const result = yield* Effect.exit(decode({
          from: "Draft",
          to: "PendingApproval",
          description: ""
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isStatusTransition returns true for valid transitions", () => {
      const transition = StatusTransition.make({
        from: "Draft",
        to: "PendingApproval",
        description: "Submit"
      })
      expect(isStatusTransition(transition)).toBe(true)
    })

    it("isStatusTransition returns false for invalid values", () => {
      expect(isStatusTransition(null)).toBe(false)
      expect(isStatusTransition(undefined)).toBe(false)
      expect(isStatusTransition({})).toBe(false)
      expect(isStatusTransition({ from: "Draft" })).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for StatusTransition", () => {
      const t1 = StatusTransition.make({
        from: "Draft",
        to: "PendingApproval",
        description: "Submit"
      })
      const t2 = StatusTransition.make({
        from: "Draft",
        to: "PendingApproval",
        description: "Submit"
      })
      const t3 = StatusTransition.make({
        from: "Draft",
        to: "Approved",
        description: "Different"
      })

      expect(Equal.equals(t1, t2)).toBe(true)
      expect(Equal.equals(t1, t3)).toBe(false)
    })
  })
})

describe("TransitionAction", () => {
  const allActions: TransitionAction[] = [
    "Submit",
    "Approve",
    "Reject",
    "Post",
    "MarkReversed"
  ]

  describe("validation", () => {
    it.effect("accepts all valid actions", () =>
      Effect.gen(function* () {
        for (const action of allActions) {
          const result = yield* Schema.decodeUnknown(TransitionAction)(action)
          expect(result).toBe(action)
        }
      })
    )

    it.effect("rejects invalid actions", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TransitionAction)
        const result = yield* Effect.exit(decode("InvalidAction"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isTransitionAction returns true for valid actions", () => {
      for (const action of allActions) {
        expect(isTransitionAction(action)).toBe(true)
      }
    })

    it("isTransitionAction returns false for invalid values", () => {
      expect(isTransitionAction("Invalid")).toBe(false)
      expect(isTransitionAction(null)).toBe(false)
      expect(isTransitionAction(123)).toBe(false)
    })
  })
})

describe("allowedTransitions", () => {
  it("contains the expected number of transitions", () => {
    expect(allowedTransitions.length).toBe(4)
  })

  it("includes Draft -> PendingApproval", () => {
    const found = allowedTransitions.some(
      t => t.from === "Draft" && t.to === "PendingApproval"
    )
    expect(found).toBe(true)
  })

  it("includes PendingApproval -> Approved", () => {
    const found = allowedTransitions.some(
      t => t.from === "PendingApproval" && t.to === "Approved"
    )
    expect(found).toBe(true)
  })

  it("includes PendingApproval -> Draft (rejection)", () => {
    const found = allowedTransitions.some(
      t => t.from === "PendingApproval" && t.to === "Draft"
    )
    expect(found).toBe(true)
  })

  it("includes Approved -> Posted", () => {
    const found = allowedTransitions.some(
      t => t.from === "Approved" && t.to === "Posted"
    )
    expect(found).toBe(true)
  })

  it("does NOT include Posted -> Reversed directly", () => {
    const found = allowedTransitions.some(
      t => t.from === "Posted" && t.to === "Reversed"
    )
    expect(found).toBe(false)
  })
})

describe("internalTransitions", () => {
  it("contains the Posted -> Reversed transition", () => {
    expect(internalTransitions.length).toBe(1)
    expect(internalTransitions[0].from).toBe("Posted")
    expect(internalTransitions[0].to).toBe("Reversed")
  })
})

describe("allTransitions", () => {
  it("combines allowed and internal transitions", () => {
    expect(allTransitions.length).toBe(5)
    expect(allTransitions.length).toBe(
      allowedTransitions.length + internalTransitions.length
    )
  })
})

describe("InvalidStatusTransitionError", () => {
  describe("creation", () => {
    it("creates error with reason", () => {
      const error = new InvalidStatusTransitionError({
        from: "Draft",
        to: "Posted",
        reason: Option.some("Invalid direct transition")
      })
      expect(error.from).toBe("Draft")
      expect(error.to).toBe("Posted")
      expect(Option.isSome(error.reason)).toBe(true)
      expect(Option.getOrNull(error.reason)).toBe("Invalid direct transition")
    })

    it("creates error without reason", () => {
      const error = new InvalidStatusTransitionError({
        from: "Draft",
        to: "Posted",
        reason: Option.none()
      })
      expect(error.from).toBe("Draft")
      expect(error.to).toBe("Posted")
      expect(Option.isNone(error.reason)).toBe(true)
    })
  })

  describe("message property", () => {
    it("includes reason when present", () => {
      const error = new InvalidStatusTransitionError({
        from: "Draft",
        to: "Posted",
        reason: Option.some("Not allowed")
      })
      expect(error.message).toBe("Cannot transition from 'Draft' to 'Posted': Not allowed")
    })

    it("excludes reason when not present", () => {
      const error = new InvalidStatusTransitionError({
        from: "Draft",
        to: "Posted",
        reason: Option.none()
      })
      expect(error.message).toBe("Cannot transition from 'Draft' to 'Posted'")
    })
  })

  describe("_tag property", () => {
    it("has correct tag", () => {
      const error = new InvalidStatusTransitionError({
        from: "Draft",
        to: "Posted",
        reason: Option.none()
      })
      expect(error._tag).toBe("InvalidStatusTransitionError")
    })
  })

  describe("type guard", () => {
    it("isInvalidStatusTransitionError returns true for the error", () => {
      const error = new InvalidStatusTransitionError({
        from: "Draft",
        to: "Posted",
        reason: Option.none()
      })
      expect(isInvalidStatusTransitionError(error)).toBe(true)
    })

    it("isInvalidStatusTransitionError returns false for other values", () => {
      expect(isInvalidStatusTransitionError(null)).toBe(false)
      expect(isInvalidStatusTransitionError(new Error())).toBe(false)
      expect(isInvalidStatusTransitionError({})).toBe(false)
    })
  })
})

describe("canTransition", () => {
  describe("allowed transitions", () => {
    it("Draft -> PendingApproval is allowed", () => {
      expect(canTransition("Draft", "PendingApproval")).toBe(true)
    })

    it("PendingApproval -> Approved is allowed", () => {
      expect(canTransition("PendingApproval", "Approved")).toBe(true)
    })

    it("PendingApproval -> Draft is allowed (rejection)", () => {
      expect(canTransition("PendingApproval", "Draft")).toBe(true)
    })

    it("Approved -> Posted is allowed", () => {
      expect(canTransition("Approved", "Posted")).toBe(true)
    })
  })

  describe("disallowed transitions", () => {
    it("Draft -> Approved is not allowed", () => {
      expect(canTransition("Draft", "Approved")).toBe(false)
    })

    it("Draft -> Posted is not allowed", () => {
      expect(canTransition("Draft", "Posted")).toBe(false)
    })

    it("Draft -> Reversed is not allowed", () => {
      expect(canTransition("Draft", "Reversed")).toBe(false)
    })

    it("Draft -> Draft is not allowed", () => {
      expect(canTransition("Draft", "Draft")).toBe(false)
    })

    it("PendingApproval -> Posted is not allowed", () => {
      expect(canTransition("PendingApproval", "Posted")).toBe(false)
    })

    it("PendingApproval -> Reversed is not allowed", () => {
      expect(canTransition("PendingApproval", "Reversed")).toBe(false)
    })

    it("PendingApproval -> PendingApproval is not allowed", () => {
      expect(canTransition("PendingApproval", "PendingApproval")).toBe(false)
    })

    it("Approved -> Draft is not allowed", () => {
      expect(canTransition("Approved", "Draft")).toBe(false)
    })

    it("Approved -> PendingApproval is not allowed", () => {
      expect(canTransition("Approved", "PendingApproval")).toBe(false)
    })

    it("Approved -> Reversed is not allowed", () => {
      expect(canTransition("Approved", "Reversed")).toBe(false)
    })

    it("Approved -> Approved is not allowed", () => {
      expect(canTransition("Approved", "Approved")).toBe(false)
    })

    it("Posted -> Draft is not allowed", () => {
      expect(canTransition("Posted", "Draft")).toBe(false)
    })

    it("Posted -> PendingApproval is not allowed", () => {
      expect(canTransition("Posted", "PendingApproval")).toBe(false)
    })

    it("Posted -> Approved is not allowed", () => {
      expect(canTransition("Posted", "Approved")).toBe(false)
    })

    it("Posted -> Posted is not allowed", () => {
      expect(canTransition("Posted", "Posted")).toBe(false)
    })

    it("Posted -> Reversed is NOT allowed via direct transition", () => {
      expect(canTransition("Posted", "Reversed")).toBe(false)
    })

    it("Reversed -> Draft is not allowed", () => {
      expect(canTransition("Reversed", "Draft")).toBe(false)
    })

    it("Reversed -> PendingApproval is not allowed", () => {
      expect(canTransition("Reversed", "PendingApproval")).toBe(false)
    })

    it("Reversed -> Approved is not allowed", () => {
      expect(canTransition("Reversed", "Approved")).toBe(false)
    })

    it("Reversed -> Posted is not allowed", () => {
      expect(canTransition("Reversed", "Posted")).toBe(false)
    })

    it("Reversed -> Reversed is not allowed", () => {
      expect(canTransition("Reversed", "Reversed")).toBe(false)
    })
  })
})

describe("canTransitionViaReversal", () => {
  it("Posted -> Reversed returns true", () => {
    expect(canTransitionViaReversal("Posted", "Reversed")).toBe(true)
  })

  it("other transitions return false", () => {
    expect(canTransitionViaReversal("Draft", "Reversed")).toBe(false)
    expect(canTransitionViaReversal("PendingApproval", "Reversed")).toBe(false)
    expect(canTransitionViaReversal("Approved", "Reversed")).toBe(false)
    expect(canTransitionViaReversal("Reversed", "Reversed")).toBe(false)
    expect(canTransitionViaReversal("Posted", "Draft")).toBe(false)
    expect(canTransitionViaReversal("Posted", "Posted")).toBe(false)
  })
})

describe("canTransitionIncludingInternal", () => {
  it("includes all direct transitions", () => {
    expect(canTransitionIncludingInternal("Draft", "PendingApproval")).toBe(true)
    expect(canTransitionIncludingInternal("PendingApproval", "Approved")).toBe(true)
    expect(canTransitionIncludingInternal("PendingApproval", "Draft")).toBe(true)
    expect(canTransitionIncludingInternal("Approved", "Posted")).toBe(true)
  })

  it("includes Posted -> Reversed internal transition", () => {
    expect(canTransitionIncludingInternal("Posted", "Reversed")).toBe(true)
  })

  it("rejects invalid transitions", () => {
    expect(canTransitionIncludingInternal("Draft", "Posted")).toBe(false)
    expect(canTransitionIncludingInternal("Reversed", "Draft")).toBe(false)
  })
})

describe("getTransitionDescription", () => {
  it("returns description for allowed transitions", () => {
    expect(getTransitionDescription("Draft", "PendingApproval")).toBe(
      "Submit entry for approval"
    )
    expect(getTransitionDescription("PendingApproval", "Approved")).toBe(
      "Approve the entry"
    )
    expect(getTransitionDescription("PendingApproval", "Draft")).toBe(
      "Reject entry and return for edits"
    )
    expect(getTransitionDescription("Approved", "Posted")).toBe(
      "Post entry to general ledger"
    )
  })

  it("returns description for internal transitions", () => {
    expect(getTransitionDescription("Posted", "Reversed")).toBe(
      "Mark entry as reversed (only via reversal entry creation)"
    )
  })

  it("returns undefined for invalid transitions", () => {
    expect(getTransitionDescription("Draft", "Posted")).toBeUndefined()
    expect(getTransitionDescription("Reversed", "Draft")).toBeUndefined()
  })
})

describe("getAllowedTransitionsFrom", () => {
  it("returns [PendingApproval] for Draft", () => {
    const result = getAllowedTransitionsFrom("Draft")
    expect(result).toEqual(["PendingApproval"])
  })

  it("returns [Approved, Draft] for PendingApproval", () => {
    const result = getAllowedTransitionsFrom("PendingApproval")
    expect(result).toContain("Approved")
    expect(result).toContain("Draft")
    expect(result.length).toBe(2)
  })

  it("returns [Posted] for Approved", () => {
    const result = getAllowedTransitionsFrom("Approved")
    expect(result).toEqual(["Posted"])
  })

  it("returns [] for Posted (direct transitions only)", () => {
    const result = getAllowedTransitionsFrom("Posted")
    expect(result).toEqual([])
  })

  it("returns [] for Reversed", () => {
    const result = getAllowedTransitionsFrom("Reversed")
    expect(result).toEqual([])
  })
})

describe("getTransitionAction", () => {
  it("returns Submit for Draft -> PendingApproval", () => {
    expect(getTransitionAction("Draft", "PendingApproval")).toBe("Submit")
  })

  it("returns Approve for PendingApproval -> Approved", () => {
    expect(getTransitionAction("PendingApproval", "Approved")).toBe("Approve")
  })

  it("returns Reject for PendingApproval -> Draft", () => {
    expect(getTransitionAction("PendingApproval", "Draft")).toBe("Reject")
  })

  it("returns Post for Approved -> Posted", () => {
    expect(getTransitionAction("Approved", "Posted")).toBe("Post")
  })

  it("returns MarkReversed for Posted -> Reversed", () => {
    expect(getTransitionAction("Posted", "Reversed")).toBe("MarkReversed")
  })

  it("returns undefined for invalid transitions", () => {
    expect(getTransitionAction("Draft", "Posted")).toBeUndefined()
    expect(getTransitionAction("Draft", "Approved")).toBeUndefined()
    expect(getTransitionAction("Reversed", "Draft")).toBeUndefined()
    expect(getTransitionAction("Posted", "Draft")).toBeUndefined()
  })
})

describe("validateTransition", () => {
  describe("valid transitions", () => {
    it.effect("succeeds for Draft -> PendingApproval", () =>
      Effect.gen(function* () {
        const result = yield* validateTransition("Draft", "PendingApproval")
        expect(result).toBe("PendingApproval")
      })
    )

    it.effect("succeeds for PendingApproval -> Approved", () =>
      Effect.gen(function* () {
        const result = yield* validateTransition("PendingApproval", "Approved")
        expect(result).toBe("Approved")
      })
    )

    it.effect("succeeds for PendingApproval -> Draft", () =>
      Effect.gen(function* () {
        const result = yield* validateTransition("PendingApproval", "Draft")
        expect(result).toBe("Draft")
      })
    )

    it.effect("succeeds for Approved -> Posted", () =>
      Effect.gen(function* () {
        const result = yield* validateTransition("Approved", "Posted")
        expect(result).toBe("Posted")
      })
    )
  })

  describe("invalid transitions from Draft", () => {
    it.effect("fails for Draft -> Approved", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Draft", "Approved"))
        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result)) {
          const error = result.cause
          expect(error._tag).toBe("Fail")
        }
      })
    )

    it.effect("fails for Draft -> Posted", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Draft", "Posted"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Draft -> Reversed", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Draft", "Reversed"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Draft -> Draft", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Draft", "Draft"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("invalid transitions from PendingApproval", () => {
    it.effect("fails for PendingApproval -> Posted", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("PendingApproval", "Posted"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for PendingApproval -> Reversed", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("PendingApproval", "Reversed"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for PendingApproval -> PendingApproval", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("PendingApproval", "PendingApproval"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("invalid transitions from Approved", () => {
    it.effect("fails for Approved -> Draft", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Approved", "Draft"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Approved -> PendingApproval", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Approved", "PendingApproval"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Approved -> Reversed", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Approved", "Reversed"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Approved -> Approved", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Approved", "Approved"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("invalid transitions from Posted", () => {
    it.effect("fails for Posted -> Draft", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Posted", "Draft"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Posted -> PendingApproval", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Posted", "PendingApproval"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Posted -> Approved", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Posted", "Approved"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Posted -> Posted", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Posted", "Posted"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Posted -> Reversed (requires reversal entry)", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Posted", "Reversed"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("invalid transitions from Reversed", () => {
    it.effect("fails for Reversed -> Draft", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Reversed", "Draft"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Reversed -> PendingApproval", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Reversed", "PendingApproval"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Reversed -> Approved", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Reversed", "Approved"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Reversed -> Posted", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Reversed", "Posted"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for Reversed -> Reversed", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateTransition("Reversed", "Reversed"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })
})

describe("validateTransitionIncludingInternal", () => {
  it.effect("succeeds for all allowed transitions", () =>
    Effect.gen(function* () {
      yield* validateTransitionIncludingInternal("Draft", "PendingApproval")
      yield* validateTransitionIncludingInternal("PendingApproval", "Approved")
      yield* validateTransitionIncludingInternal("PendingApproval", "Draft")
      yield* validateTransitionIncludingInternal("Approved", "Posted")
    })
  )

  it.effect("succeeds for Posted -> Reversed", () =>
    Effect.gen(function* () {
      const result = yield* validateTransitionIncludingInternal("Posted", "Reversed")
      expect(result).toBe("Reversed")
    })
  )

  it.effect("fails for invalid transitions", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        validateTransitionIncludingInternal("Draft", "Posted")
      )
      expect(Exit.isFailure(result)).toBe(true)
    })
  )
})

describe("getNextStatus", () => {
  it("returns PendingApproval for Draft + Submit", () => {
    expect(getNextStatus("Draft", "Submit")).toBe("PendingApproval")
  })

  it("returns Approved for PendingApproval + Approve", () => {
    expect(getNextStatus("PendingApproval", "Approve")).toBe("Approved")
  })

  it("returns Draft for PendingApproval + Reject", () => {
    expect(getNextStatus("PendingApproval", "Reject")).toBe("Draft")
  })

  it("returns Posted for Approved + Post", () => {
    expect(getNextStatus("Approved", "Post")).toBe("Posted")
  })

  it("returns Reversed for Posted + MarkReversed", () => {
    expect(getNextStatus("Posted", "MarkReversed")).toBe("Reversed")
  })

  it("returns undefined for invalid combinations", () => {
    expect(getNextStatus("Draft", "Approve")).toBeUndefined()
    expect(getNextStatus("Draft", "Reject")).toBeUndefined()
    expect(getNextStatus("Draft", "Post")).toBeUndefined()
    expect(getNextStatus("Draft", "MarkReversed")).toBeUndefined()
    expect(getNextStatus("PendingApproval", "Submit")).toBeUndefined()
    expect(getNextStatus("PendingApproval", "Post")).toBeUndefined()
    expect(getNextStatus("PendingApproval", "MarkReversed")).toBeUndefined()
    expect(getNextStatus("Approved", "Submit")).toBeUndefined()
    expect(getNextStatus("Approved", "Approve")).toBeUndefined()
    expect(getNextStatus("Approved", "Reject")).toBeUndefined()
    expect(getNextStatus("Approved", "MarkReversed")).toBeUndefined()
    expect(getNextStatus("Posted", "Submit")).toBeUndefined()
    expect(getNextStatus("Posted", "Approve")).toBeUndefined()
    expect(getNextStatus("Posted", "Reject")).toBeUndefined()
    expect(getNextStatus("Posted", "Post")).toBeUndefined()
    expect(getNextStatus("Reversed", "Submit")).toBeUndefined()
    expect(getNextStatus("Reversed", "Approve")).toBeUndefined()
    expect(getNextStatus("Reversed", "Reject")).toBeUndefined()
    expect(getNextStatus("Reversed", "Post")).toBeUndefined()
    expect(getNextStatus("Reversed", "MarkReversed")).toBeUndefined()
  })
})

describe("isActionValidForStatus", () => {
  it("Submit is valid only for Draft", () => {
    expect(isActionValidForStatus("Draft", "Submit")).toBe(true)
    expect(isActionValidForStatus("PendingApproval", "Submit")).toBe(false)
    expect(isActionValidForStatus("Approved", "Submit")).toBe(false)
    expect(isActionValidForStatus("Posted", "Submit")).toBe(false)
    expect(isActionValidForStatus("Reversed", "Submit")).toBe(false)
  })

  it("Approve is valid only for PendingApproval", () => {
    expect(isActionValidForStatus("Draft", "Approve")).toBe(false)
    expect(isActionValidForStatus("PendingApproval", "Approve")).toBe(true)
    expect(isActionValidForStatus("Approved", "Approve")).toBe(false)
    expect(isActionValidForStatus("Posted", "Approve")).toBe(false)
    expect(isActionValidForStatus("Reversed", "Approve")).toBe(false)
  })

  it("Reject is valid only for PendingApproval", () => {
    expect(isActionValidForStatus("Draft", "Reject")).toBe(false)
    expect(isActionValidForStatus("PendingApproval", "Reject")).toBe(true)
    expect(isActionValidForStatus("Approved", "Reject")).toBe(false)
    expect(isActionValidForStatus("Posted", "Reject")).toBe(false)
    expect(isActionValidForStatus("Reversed", "Reject")).toBe(false)
  })

  it("Post is valid only for Approved", () => {
    expect(isActionValidForStatus("Draft", "Post")).toBe(false)
    expect(isActionValidForStatus("PendingApproval", "Post")).toBe(false)
    expect(isActionValidForStatus("Approved", "Post")).toBe(true)
    expect(isActionValidForStatus("Posted", "Post")).toBe(false)
    expect(isActionValidForStatus("Reversed", "Post")).toBe(false)
  })

  it("MarkReversed is valid only for Posted", () => {
    expect(isActionValidForStatus("Draft", "MarkReversed")).toBe(false)
    expect(isActionValidForStatus("PendingApproval", "MarkReversed")).toBe(false)
    expect(isActionValidForStatus("Approved", "MarkReversed")).toBe(false)
    expect(isActionValidForStatus("Posted", "MarkReversed")).toBe(true)
    expect(isActionValidForStatus("Reversed", "MarkReversed")).toBe(false)
  })
})

describe("getValidActionsForStatus", () => {
  it("returns [Submit] for Draft", () => {
    expect(getValidActionsForStatus("Draft")).toEqual(["Submit"])
  })

  it("returns [Approve, Reject] for PendingApproval", () => {
    const actions = getValidActionsForStatus("PendingApproval")
    expect(actions).toContain("Approve")
    expect(actions).toContain("Reject")
    expect(actions.length).toBe(2)
  })

  it("returns [Post] for Approved", () => {
    expect(getValidActionsForStatus("Approved")).toEqual(["Post"])
  })

  it("returns [MarkReversed] for Posted", () => {
    expect(getValidActionsForStatus("Posted")).toEqual(["MarkReversed"])
  })

  it("returns [] for Reversed", () => {
    expect(getValidActionsForStatus("Reversed")).toEqual([])
  })
})

describe("getUserActionsForStatus", () => {
  it("returns [Submit] for Draft", () => {
    expect(getUserActionsForStatus("Draft")).toEqual(["Submit"])
  })

  it("returns [Approve, Reject] for PendingApproval", () => {
    const actions = getUserActionsForStatus("PendingApproval")
    expect(actions).toContain("Approve")
    expect(actions).toContain("Reject")
    expect(actions.length).toBe(2)
  })

  it("returns [Post] for Approved", () => {
    expect(getUserActionsForStatus("Approved")).toEqual(["Post"])
  })

  it("returns [] for Posted (MarkReversed is internal)", () => {
    expect(getUserActionsForStatus("Posted")).toEqual([])
  })

  it("returns [] for Reversed", () => {
    expect(getUserActionsForStatus("Reversed")).toEqual([])
  })
})

describe("isTerminalStatus", () => {
  it("returns false for Draft", () => {
    expect(isTerminalStatus("Draft")).toBe(false)
  })

  it("returns false for PendingApproval", () => {
    expect(isTerminalStatus("PendingApproval")).toBe(false)
  })

  it("returns false for Approved", () => {
    expect(isTerminalStatus("Approved")).toBe(false)
  })

  it("returns false for Posted (can become Reversed)", () => {
    expect(isTerminalStatus("Posted")).toBe(false)
  })

  it("returns true for Reversed", () => {
    expect(isTerminalStatus("Reversed")).toBe(true)
  })
})

describe("isEditableStatus", () => {
  it("returns true for Draft", () => {
    expect(isEditableStatus("Draft")).toBe(true)
  })

  it("returns false for PendingApproval", () => {
    expect(isEditableStatus("PendingApproval")).toBe(false)
  })

  it("returns false for Approved", () => {
    expect(isEditableStatus("Approved")).toBe(false)
  })

  it("returns false for Posted", () => {
    expect(isEditableStatus("Posted")).toBe(false)
  })

  it("returns false for Reversed", () => {
    expect(isEditableStatus("Reversed")).toBe(false)
  })
})

describe("isDeletableStatus", () => {
  it("returns true for Draft", () => {
    expect(isDeletableStatus("Draft")).toBe(true)
  })

  it("returns false for PendingApproval", () => {
    expect(isDeletableStatus("PendingApproval")).toBe(false)
  })

  it("returns false for Approved", () => {
    expect(isDeletableStatus("Approved")).toBe(false)
  })

  it("returns false for Posted", () => {
    expect(isDeletableStatus("Posted")).toBe(false)
  })

  it("returns false for Reversed", () => {
    expect(isDeletableStatus("Reversed")).toBe(false)
  })
})

describe("encoding and decoding", () => {
  it.effect("StatusTransition encodes and decodes", () =>
    Effect.gen(function* () {
      const original = StatusTransition.make({
        from: "Draft",
        to: "PendingApproval",
        description: "Submit for approval"
      })
      const encoded = yield* Schema.encode(StatusTransition)(original)
      const decoded = yield* Schema.decodeUnknown(StatusTransition)(encoded)
      expect(Equal.equals(original, decoded)).toBe(true)
    })
  )

  it.effect("InvalidStatusTransitionError encodes and decodes", () =>
    Effect.gen(function* () {
      const original = new InvalidStatusTransitionError({
        from: "Draft",
        to: "Posted",
        reason: Option.some("Not allowed")
      })
      const encoded = yield* Schema.encode(InvalidStatusTransitionError)(original)
      const decoded = yield* Schema.decodeUnknown(InvalidStatusTransitionError)(encoded)
      expect(decoded._tag).toBe(original._tag)
      expect(decoded.from).toBe(original.from)
      expect(decoded.to).toBe(original.to)
    })
  )
})

describe("complete workflow scenarios", () => {
  it("full happy path: Draft -> PendingApproval -> Approved -> Posted", () => {
    let status: JournalEntryStatus = "Draft"

    // Submit for approval
    expect(canTransition(status, "PendingApproval")).toBe(true)
    expect(getTransitionAction(status, "PendingApproval")).toBe("Submit")
    status = "PendingApproval"

    // Approve
    expect(canTransition(status, "Approved")).toBe(true)
    expect(getTransitionAction(status, "Approved")).toBe("Approve")
    status = "Approved"

    // Post
    expect(canTransition(status, "Posted")).toBe(true)
    expect(getTransitionAction(status, "Posted")).toBe("Post")
    status = "Posted"

    // Cannot transition further via direct transition
    expect(canTransition(status, "Reversed")).toBe(false)

    // But can via reversal entry
    expect(canTransitionViaReversal(status, "Reversed")).toBe(true)
  })

  it("rejection path: Draft -> PendingApproval -> Draft", () => {
    let status: JournalEntryStatus = "Draft"

    // Submit for approval
    expect(canTransition(status, "PendingApproval")).toBe(true)
    status = "PendingApproval"

    // Reject (return to draft)
    expect(canTransition(status, "Draft")).toBe(true)
    expect(getTransitionAction(status, "Draft")).toBe("Reject")
    status = "Draft"

    // Can submit again
    expect(canTransition(status, "PendingApproval")).toBe(true)
  })

  it("attempt to skip statuses fails", () => {
    // Cannot skip from Draft to Approved
    expect(canTransition("Draft", "Approved")).toBe(false)

    // Cannot skip from Draft to Posted
    expect(canTransition("Draft", "Posted")).toBe(false)

    // Cannot skip from PendingApproval to Posted
    expect(canTransition("PendingApproval", "Posted")).toBe(false)
  })

  it("cannot modify after posting", () => {
    const status: JournalEntryStatus = "Posted"

    // Cannot go back to any previous status
    expect(canTransition(status, "Draft")).toBe(false)
    expect(canTransition(status, "PendingApproval")).toBe(false)
    expect(canTransition(status, "Approved")).toBe(false)

    // Status helpers confirm this
    expect(isEditableStatus(status)).toBe(false)
    expect(isDeletableStatus(status)).toBe(false)
  })

  it("reversed is terminal", () => {
    const status: JournalEntryStatus = "Reversed"

    // Cannot transition to any status
    expect(getAllowedTransitionsFrom(status)).toEqual([])
    expect(isTerminalStatus(status)).toBe(true)
    expect(getUserActionsForStatus(status)).toEqual([])
  })
})
