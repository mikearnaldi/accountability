/**
 * EliminationRulesApiLive - Live implementation of elimination rules API handlers
 *
 * Implements the EliminationRulesApi endpoints with real CRUD operations
 * by calling the EliminationRuleRepository.
 *
 * @module EliminationRulesApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Array from "effect/Array"
import {
  EliminationRule,
  TriggerCondition
} from "@accountability/core/consolidation/EliminationRule"
import { EliminationRuleId } from "@accountability/core/consolidation/ConsolidationGroup"
import { EliminationRuleRepository } from "@accountability/persistence/Services/EliminationRuleRepository"
import { ConsolidationRepository } from "@accountability/persistence/Services/ConsolidationRepository"
import { isEntityNotFoundError } from "@accountability/persistence/Errors/RepositoryError"
import {
  EliminationRuleNotFoundError,
  EliminationRuleOperationFailedError,
  ConsolidationGroupNotFoundError
} from "@accountability/core/consolidation/ConsolidationErrors"
import { AppApi } from "../Definitions/AppApi.ts"

/**
 * EliminationRulesApiLive - Layer providing EliminationRulesApi handlers
 *
 * Dependencies:
 * - EliminationRuleRepository
 * - ConsolidationRepository (for group validation)
 */
export const EliminationRulesApiLive = HttpApiBuilder.group(AppApi, "eliminationRules", (handlers) =>
  Effect.gen(function* () {
    const eliminationRuleRepo = yield* EliminationRuleRepository
    const consolidationRepo = yield* ConsolidationRepository

    return handlers
      .handle("listEliminationRules", (_) =>
        Effect.gen(function* () {
          const { consolidationGroupId, eliminationType, isActive, isAutomatic, highPriorityOnly } = _.urlParams

          let rules: ReadonlyArray<EliminationRule>

          if (consolidationGroupId !== undefined) {
            if (isActive === true) {
              rules = yield* eliminationRuleRepo.findActiveByConsolidationGroup(consolidationGroupId).pipe(
                Effect.orDie
              )
            } else if (isAutomatic === true) {
              rules = yield* eliminationRuleRepo.findAutomaticByConsolidationGroup(consolidationGroupId).pipe(
                Effect.orDie
              )
            } else if (highPriorityOnly === true) {
              rules = yield* eliminationRuleRepo.findHighPriority(consolidationGroupId).pipe(
                Effect.orDie
              )
            } else if (eliminationType !== undefined) {
              rules = yield* eliminationRuleRepo.findByType(consolidationGroupId, eliminationType).pipe(
                Effect.orDie
              )
            } else {
              rules = yield* eliminationRuleRepo.findByConsolidationGroup(consolidationGroupId).pipe(
                Effect.orDie
              )
            }
          } else {
            // No filter - return empty for now
            rules = []
          }

          // Apply additional filters
          if (isActive === false) {
            rules = rules.filter((r) => !r.isActive)
          }
          if (isAutomatic === false) {
            rules = rules.filter((r) => !r.isAutomatic)
          }

          // Apply pagination
          const total = rules.length
          const limit = _.urlParams.limit ?? 100
          const offset = _.urlParams.offset ?? 0
          const paginatedRules = rules.slice(offset, offset + limit)

          return {
            rules: paginatedRules,
            total,
            limit,
            offset
          }
        })
      )
      .handle("getEliminationRule", (_) =>
        Effect.gen(function* () {
          const ruleId = _.path.id

          const maybeRule = yield* eliminationRuleRepo.findById(ruleId).pipe(
            Effect.orDie
          )

          return yield* Option.match(maybeRule, {
            onNone: () => Effect.fail(new EliminationRuleNotFoundError({ ruleId })),
            onSome: Effect.succeed
          })
        })
      )
      .handle("createEliminationRule", (_) =>
        Effect.gen(function* () {
          const req = _.payload

          // Validate consolidation group exists
          const groupExists = yield* consolidationRepo.groupExists(req.organizationId, req.consolidationGroupId).pipe(
            Effect.orDie
          )
          if (!groupExists) {
            return yield* Effect.fail(new ConsolidationGroupNotFoundError({
              groupId: req.consolidationGroupId
            }))
          }

          // Convert trigger conditions from input to domain
          const triggerConditions = Chunk.fromIterable(
            req.triggerConditions.map((tc) =>
              TriggerCondition.make({
                description: tc.description,
                sourceAccounts: Chunk.fromIterable(tc.sourceAccounts),
                minimumAmount: tc.minimumAmount
              })
            )
          )

          // Create the rule
          const newRule = EliminationRule.make({
            id: EliminationRuleId.make(crypto.randomUUID()),
            consolidationGroupId: req.consolidationGroupId,
            name: req.name,
            description: req.description,
            eliminationType: req.eliminationType,
            triggerConditions,
            sourceAccounts: Chunk.fromIterable(req.sourceAccounts),
            targetAccounts: Chunk.fromIterable(req.targetAccounts),
            debitAccountId: req.debitAccountId,
            creditAccountId: req.creditAccountId,
            isAutomatic: req.isAutomatic,
            priority: req.priority,
            isActive: req.isActive ?? true
          })

          return yield* eliminationRuleRepo.create(newRule).pipe(
            Effect.orDie
          )
        })
      )
      .handle("bulkCreateEliminationRules", (_) =>
        Effect.gen(function* () {
          const req = _.payload

          // Validate all consolidation groups exist
          // Build a map of org+group pairs to check
          const uniquePairs = new Map<string, { organizationId: typeof req.rules[0]["organizationId"]; groupId: typeof req.rules[0]["consolidationGroupId"] }>()
          for (const r of req.rules) {
            const key = `${r.organizationId}:${r.consolidationGroupId}`
            if (!uniquePairs.has(key)) {
              uniquePairs.set(key, { organizationId: r.organizationId, groupId: r.consolidationGroupId })
            }
          }
          for (const { organizationId, groupId } of uniquePairs.values()) {
            const groupExists = yield* consolidationRepo.groupExists(organizationId, groupId).pipe(
              Effect.orDie
            )
            if (!groupExists) {
              return yield* Effect.fail(new ConsolidationGroupNotFoundError({
                groupId
              }))
            }
          }

          // Create all rules
          const newRules = req.rules.map((ruleReq) => {
            const triggerConditions = Chunk.fromIterable(
              ruleReq.triggerConditions.map((tc) =>
                TriggerCondition.make({
                  description: tc.description,
                  sourceAccounts: Chunk.fromIterable(tc.sourceAccounts),
                  minimumAmount: tc.minimumAmount
                })
              )
            )

            return EliminationRule.make({
              id: EliminationRuleId.make(crypto.randomUUID()),
              consolidationGroupId: ruleReq.consolidationGroupId,
              name: ruleReq.name,
              description: ruleReq.description,
              eliminationType: ruleReq.eliminationType,
              triggerConditions,
              sourceAccounts: Chunk.fromIterable(ruleReq.sourceAccounts),
              targetAccounts: Chunk.fromIterable(ruleReq.targetAccounts),
              debitAccountId: ruleReq.debitAccountId,
              creditAccountId: ruleReq.creditAccountId,
              isAutomatic: ruleReq.isAutomatic,
              priority: ruleReq.priority,
              isActive: ruleReq.isActive ?? true
            })
          })

          const created = yield* eliminationRuleRepo.createMany(newRules).pipe(
            Effect.orDie
          )

          return {
            created: Array.fromIterable(created),
            count: created.length
          }
        })
      )
      .handle("updateEliminationRule", (_) =>
        Effect.gen(function* () {
          const ruleId = _.path.id
          const req = _.payload

          // Get existing rule
          const maybeExisting = yield* eliminationRuleRepo.findById(ruleId).pipe(
            Effect.orDie
          )
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new EliminationRuleNotFoundError({ ruleId }))
          }
          const existing = maybeExisting.value

          // Build trigger conditions if provided
          let triggerConditions = existing.triggerConditions
          if (Option.isSome(req.triggerConditions)) {
            triggerConditions = Chunk.fromIterable(
              req.triggerConditions.value.map((tc) =>
                TriggerCondition.make({
                  description: tc.description,
                  sourceAccounts: Chunk.fromIterable(tc.sourceAccounts),
                  minimumAmount: tc.minimumAmount
                })
              )
            )
          }

          // Build updated rule
          const updatedRule = EliminationRule.make({
            ...existing,
            name: Option.isSome(req.name) ? req.name.value : existing.name,
            description: Option.isSome(req.description) ? req.description : existing.description,
            triggerConditions,
            sourceAccounts: Option.isSome(req.sourceAccounts)
              ? Chunk.fromIterable(req.sourceAccounts.value)
              : existing.sourceAccounts,
            targetAccounts: Option.isSome(req.targetAccounts)
              ? Chunk.fromIterable(req.targetAccounts.value)
              : existing.targetAccounts,
            debitAccountId: Option.isSome(req.debitAccountId)
              ? req.debitAccountId.value
              : existing.debitAccountId,
            creditAccountId: Option.isSome(req.creditAccountId)
              ? req.creditAccountId.value
              : existing.creditAccountId,
            isAutomatic: Option.isSome(req.isAutomatic)
              ? req.isAutomatic.value
              : existing.isAutomatic
          })

          return yield* eliminationRuleRepo.update(updatedRule).pipe(
            Effect.orDie
          )
        })
      )
      .handle("deleteEliminationRule", (_) =>
        Effect.gen(function* () {
          const ruleId = _.path.id

          // Check if exists
          const exists = yield* eliminationRuleRepo.exists(ruleId).pipe(
            Effect.orDie
          )
          if (!exists) {
            return yield* Effect.fail(new EliminationRuleNotFoundError({ ruleId }))
          }

          yield* eliminationRuleRepo.delete(ruleId).pipe(
            Effect.orDie
          )
        })
      )
      .handle("activateEliminationRule", (_) =>
        Effect.gen(function* () {
          const ruleId = _.path.id

          return yield* eliminationRuleRepo.activate(ruleId).pipe(
            Effect.mapError((e) => {
              if (isEntityNotFoundError(e)) {
                return new EliminationRuleNotFoundError({ ruleId })
              }
              return new EliminationRuleOperationFailedError({ operation: "activate", reason: e.message })
            })
          )
        })
      )
      .handle("deactivateEliminationRule", (_) =>
        Effect.gen(function* () {
          const ruleId = _.path.id

          return yield* eliminationRuleRepo.deactivate(ruleId).pipe(
            Effect.mapError((e) => {
              if (isEntityNotFoundError(e)) {
                return new EliminationRuleNotFoundError({ ruleId })
              }
              return new EliminationRuleOperationFailedError({ operation: "deactivate", reason: e.message })
            })
          )
        })
      )
      .handle("updateEliminationRulePriority", (_) =>
        Effect.gen(function* () {
          const ruleId = _.path.id
          const { priority } = _.payload

          return yield* eliminationRuleRepo.updatePriority(ruleId, priority).pipe(
            Effect.mapError((e) => {
              if (isEntityNotFoundError(e)) {
                return new EliminationRuleNotFoundError({ ruleId })
              }
              return new EliminationRuleOperationFailedError({ operation: "updatePriority", reason: e.message })
            })
          )
        })
      )
      .handle("getEliminationRulesByType", (_) =>
        Effect.gen(function* () {
          const { consolidationGroupId, eliminationType } = _.urlParams

          const rules = yield* eliminationRuleRepo.findByType(consolidationGroupId, eliminationType).pipe(
            Effect.orDie
          )

          return {
            rules,
            total: rules.length,
            limit: 1000,
            offset: 0
          }
        })
      )
  })
)
