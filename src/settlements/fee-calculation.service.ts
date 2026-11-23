import { Injectable, BadRequestException } from '@nestjs/common';

export interface FeeResult {
  feeUsd: number;
  feeRate: number;
  tierName: string;
  netUsd: number;
}

interface FeeTier {
  name: string;
  minUsd: number;
  maxUsd: number | null;
  rate: number;
}

const FEE_TIERS: FeeTier[] = [
  { name: 'standard', minUsd: 0, maxUsd: 1000, rate: 0.029 },
  { name: 'growth', minUsd: 1000, maxUsd: 10000, rate: 0.025 },
  { name: 'scale', minUsd: 10000, maxUsd: 100000, rate: 0.02 },
  { name: 'enterprise', minUsd: 100000, maxUsd: null, rate: 0.015 },
];

@Injectable()
export class FeeCalculationService {
  async calculateFee(
    merchantId: string,
    amountUsd: number,
    customFeeRate?: number | string | null,
  ): Promise<FeeResult> {
    if (!Number.isFinite(amountUsd) || amountUsd < 0) {
      throw new BadRequestException(`Invalid amount for merchant ${merchantId}: ${amountUsd}`);
    }

    const tier = this.resolveTier(amountUsd);
    const rate = this.resolveFeeRate(customFeeRate, tier.rate);
    const feeUsd = this.round(amountUsd * rate);
    const netUsd = this.round(amountUsd - feeUsd);

    return {
      feeUsd,
      feeRate: rate,
      tierName: tier.name,
      netUsd,
    };
  }

  /**
   * Uses the merchant's custom fee rate when set, otherwise falls back to the
   * tier (global batch) rate. Invalid or negative overrides are ignored.
   */
  resolveFeeRate(customFeeRate: number | string | null | undefined, fallbackRate: number): number {
    if (customFeeRate === null || customFeeRate === undefined || customFeeRate === '') {
      return fallbackRate;
    }
    const parsed = typeof customFeeRate === 'number' ? customFeeRate : Number(customFeeRate);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallbackRate;
    }
    return parsed;
  }

  private resolveTier(amountUsd: number): FeeTier {
    for (const tier of FEE_TIERS) {
      if (amountUsd >= tier.minUsd && (tier.maxUsd === null || amountUsd < tier.maxUsd)) {
        return tier;
      }
    }
    return FEE_TIERS[FEE_TIERS.length - 1];
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
