/**
 * ConsolidationGroup - Entity for consolidation group structure
 *
 * Per ASC 810, a consolidation group defines the parent-subsidiary relationships
 * for consolidated financial reporting. It contains member companies with their
 * ownership percentages, consolidation methods, and elimination rules.
 *
 * @module ConsolidationGroup
 */

import * as Schema from "effect/Schema"
import * as Chunk from "effect/Chunk"
import { CompanyId, ConsolidationMethod } from "../company/Company.ts"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import { LocalDateFromString } from "../shared/values/LocalDate.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"
import { OrganizationId } from "../organization/Organization.ts"
import { Percentage } from "../shared/values/Percentage.ts"

/**
 * ConsolidationGroupId - Branded UUID string for consolidation group identification
 *
 * Uses Effect's built-in UUID schema with additional branding for type safety.
 */
export const ConsolidationGroupId = Schema.UUID.pipe(
  Schema.brand("ConsolidationGroupId"),
  Schema.annotations({
    identifier: "ConsolidationGroupId",
    title: "Consolidation Group ID",
    description: "A unique identifier for a consolidation group (UUID format)"
  })
)

/**
 * The branded ConsolidationGroupId type
 */
export type ConsolidationGroupId = typeof ConsolidationGroupId.Type

/**
 * Type guard for ConsolidationGroupId using Schema.is
 */
export const isConsolidationGroupId = Schema.is(ConsolidationGroupId)

/**
 * EliminationRuleId - Branded UUID string for elimination rule references
 *
 * Used to reference elimination rules within a consolidation group.
 */
export const EliminationRuleId = Schema.UUID.pipe(
  Schema.brand("EliminationRuleId"),
  Schema.annotations({
    identifier: "EliminationRuleId",
    title: "Elimination Rule ID",
    description: "A unique identifier for an elimination rule (UUID format)"
  })
)

/**
 * The branded EliminationRuleId type
 */
export type EliminationRuleId = typeof EliminationRuleId.Type

/**
 * Type guard for EliminationRuleId using Schema.is
 */
export const isEliminationRuleId = Schema.is(EliminationRuleId)

/**
 * VIE Determination - Tracks Variable Interest Entity determination
 *
 * Per ASC 810, VIE consolidation requires determining if the reporting entity
 * is the primary beneficiary with controlling financial interest.
 */
export class VIEDetermination extends Schema.Class<VIEDetermination>("VIEDetermination")({
  /**
   * Whether this company is the primary beneficiary of the VIE
   */
  isPrimaryBeneficiary: Schema.Boolean.annotations({
    title: "Is Primary Beneficiary",
    description: "Whether this entity is the primary beneficiary of the VIE"
  }),

  /**
   * Whether the entity has controlling financial interest
   */
  hasControllingFinancialInterest: Schema.Boolean.annotations({
    title: "Has Controlling Financial Interest",
    description: "Whether the entity has controlling financial interest in the VIE"
  })
}) {}

/**
 * Type guard for VIEDetermination using Schema.is
 */
export const isVIEDetermination = Schema.is(VIEDetermination)

/**
 * ConsolidationMember - Represents a member company in a consolidation group
 *
 * Each member has ownership percentage, consolidation method, acquisition details,
 * and VIE determination information per ASC 810.
 */
export class ConsolidationMember extends Schema.Class<ConsolidationMember>("ConsolidationMember")({
  /**
   * Reference to the member company
   */
  companyId: CompanyId,

  /**
   * Ownership percentage (0-100%)
   * Represents the percentage of voting interest or economic interest
   */
  ownershipPercentage: Percentage,

  /**
   * Applicable consolidation method for this member
   * - FullConsolidation: >50% voting interest
   * - EquityMethod: 20-50% significant influence
   * - CostMethod: <20% no significant influence
   * - VariableInterestEntity: Primary beneficiary regardless of voting interest
   */
  consolidationMethod: ConsolidationMethod,

  /**
   * Date when the subsidiary was acquired or the investment was made
   */
  acquisitionDate: LocalDateFromString,

  /**
   * Goodwill amount recognized at acquisition (optional)
   * Only applicable for full consolidation acquisitions
   */
  goodwillAmount: Schema.OptionFromNullOr(MonetaryAmount).annotations({
    title: "Goodwill Amount",
    description: "Goodwill recognized at acquisition, if any"
  }),

  /**
   * Non-controlling interest percentage (100 - ownership)
   * Represents minority shareholders' portion of the subsidiary
   */
  nonControllingInterestPercentage: Percentage,

  /**
   * VIE determination details (optional)
   * Only applicable when consolidation method is VariableInterestEntity
   */
  vieDetermination: Schema.OptionFromNullOr(VIEDetermination).annotations({
    title: "VIE Determination",
    description: "Variable Interest Entity determination details"
  })
}) {
  /**
   * Check if this member uses full consolidation
   */
  get isFullyConsolidated(): boolean {
    return this.consolidationMethod === "FullConsolidation" ||
           this.consolidationMethod === "VariableInterestEntity"
  }

  /**
   * Check if this member uses equity method
   */
  get isEquityMethod(): boolean {
    return this.consolidationMethod === "EquityMethod"
  }

  /**
   * Check if this member uses cost method
   */
  get isCostMethod(): boolean {
    return this.consolidationMethod === "CostMethod"
  }

  /**
   * Check if this is a Variable Interest Entity
   */
  get isVIE(): boolean {
    return this.consolidationMethod === "VariableInterestEntity"
  }

  /**
   * Check if this is a majority-owned subsidiary (>50%)
   */
  get isMajorityOwned(): boolean {
    return this.ownershipPercentage > 50
  }

  /**
   * Check if there is any non-controlling interest
   */
  get hasNonControllingInterest(): boolean {
    return this.nonControllingInterestPercentage > 0
  }
}

/**
 * Type guard for ConsolidationMember using Schema.is
 */
export const isConsolidationMember = Schema.is(ConsolidationMember)

/**
 * Encoded type interface for ConsolidationMember (needed for recursive schemas if used)
 */
export interface ConsolidationMemberEncoded extends Schema.Schema.Encoded<typeof ConsolidationMember> {}

/**
 * ConsolidationGroup - Entity representing a consolidation group structure
 *
 * Per ASC 810, a consolidation group defines the entities to be consolidated
 * for financial reporting. It contains the parent company, member subsidiaries,
 * and elimination rules for intercompany transactions.
 */
export class ConsolidationGroup extends Schema.Class<ConsolidationGroup>("ConsolidationGroup")({
  /**
   * Unique identifier for the consolidation group
   */
  id: ConsolidationGroupId,

  /**
   * Reference to parent organization
   */
  organizationId: OrganizationId,

  /**
   * Name of the consolidation group
   */
  name: Schema.NonEmptyTrimmedString.annotations({
    title: "Group Name",
    description: "The name of the consolidation group"
  }),

  /**
   * Reporting currency for consolidated financial statements
   * All member financial data will be translated to this currency
   */
  reportingCurrency: CurrencyCode,

  /**
   * Default consolidation method for the group
   */
  consolidationMethod: ConsolidationMethod,

  /**
   * Parent company (the consolidating entity)
   * This is the top-level company that produces consolidated statements
   */
  parentCompanyId: CompanyId,

  /**
   * List of member companies in the consolidation group
   * Includes subsidiaries, associates, and other investees
   */
  members: Schema.Chunk(ConsolidationMember).annotations({
    title: "Members",
    description: "Member companies in the consolidation group"
  }),

  /**
   * List of elimination rule references
   * Rules that define how intercompany transactions are eliminated
   */
  eliminationRuleIds: Schema.Chunk(EliminationRuleId).annotations({
    title: "Elimination Rules",
    description: "References to elimination rules for this group"
  }),

  /**
   * Whether the consolidation group is active
   */
  isActive: Schema.Boolean.annotations({
    title: "Is Active",
    description: "Whether the consolidation group is currently active"
  })
}) {
  /**
   * Get the total number of members in the group
   */
  get memberCount(): number {
    return Chunk.size(this.members)
  }

  /**
   * Check if the group has any members
   */
  get hasMembers(): boolean {
    return Chunk.isNonEmpty(this.members)
  }

  /**
   * Get members that use full consolidation
   */
  get fullyConsolidatedMembers(): Chunk.Chunk<ConsolidationMember> {
    return Chunk.filter(this.members, (m) => m.isFullyConsolidated)
  }

  /**
   * Get members that use equity method
   */
  get equityMethodMembers(): Chunk.Chunk<ConsolidationMember> {
    return Chunk.filter(this.members, (m) => m.isEquityMethod)
  }

  /**
   * Get members that use cost method
   */
  get costMethodMembers(): Chunk.Chunk<ConsolidationMember> {
    return Chunk.filter(this.members, (m) => m.isCostMethod)
  }

  /**
   * Get Variable Interest Entity members
   */
  get vieMembers(): Chunk.Chunk<ConsolidationMember> {
    return Chunk.filter(this.members, (m) => m.isVIE)
  }

  /**
   * Get the number of elimination rules
   */
  get eliminationRuleCount(): number {
    return Chunk.size(this.eliminationRuleIds)
  }

  /**
   * Check if the group has any elimination rules
   */
  get hasEliminationRules(): boolean {
    return Chunk.isNonEmpty(this.eliminationRuleIds)
  }

  /**
   * Find a member by company ID
   */
  findMemberByCompanyId(companyId: CompanyId): ConsolidationMember | undefined {
    return Chunk.findFirst(this.members, (m) => m.companyId === companyId).pipe(
      (opt) => opt._tag === "Some" ? opt.value : undefined
    )
  }

  /**
   * Check if a company is a member of this group
   */
  hasMember(companyId: CompanyId): boolean {
    return this.findMemberByCompanyId(companyId) !== undefined
  }

  /**
   * Get all company IDs in the group (including parent)
   */
  get allCompanyIds(): Chunk.Chunk<CompanyId> {
    return Chunk.prepend(
      Chunk.map(this.members, (m) => m.companyId),
      this.parentCompanyId
    )
  }
}

/**
 * Type guard for ConsolidationGroup using Schema.is
 */
export const isConsolidationGroup = Schema.is(ConsolidationGroup)

/**
 * Encoded type interface for ConsolidationGroup
 */
export interface ConsolidationGroupEncoded extends Schema.Schema.Encoded<typeof ConsolidationGroup> {}
