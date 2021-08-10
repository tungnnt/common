import { BigNumber } from 'bignumber.js';
import { DesiredCDPState, MarketParams, VaultInfo } from './internal/types';
import { ensureBigNumber } from './internal/utils';
import { calculateParamsIncreaseMP, calculateParamsDecreaseMP } from './internal/increaseDecreaseMP'

const  getMultiplyParams = function(
   
    marketParams: MarketParams,
    vaultInfo:VaultInfo,
    desiredCdp:DesiredCDPState,
    useFlashLoan: boolean = true,
  ): {
        debtDelta: BigNumber,
        collateralDelta: BigNumber,
        loanFee: BigNumber,
        oazoFee: BigNumber,
  }{
        let debtDelta = new BigNumber(0);
        let collateralDelta =  new BigNumber(0);
        let loanFee =  new BigNumber(0);
        let oazoFee =  new BigNumber(0);

        if(desiredCdp.withdrawColl.gt(0) || desiredCdp.withdrawDai.gt(0)){
              //decrease multiply
              [debtDelta,collateralDelta] = calculateParamsDecreaseMP(
                  marketParams.oraclePrice,
                  marketParams.marketPrice,
                  marketParams.OF,
                  marketParams.FF,
                  vaultInfo.currentCollateral.minus(desiredCdp.withdrawColl),
                  vaultInfo.currentDebt.plus(desiredCdp.withdrawDai),
                  desiredCdp.requiredCollRatio,
                  marketParams.slippage,
                  desiredCdp.providedDai,
              )
              debtDelta = debtDelta.times(-1);
              collateralDelta = collateralDelta.times(-1);
        }else{
            if(desiredCdp.providedDai.gt(0) || desiredCdp.providedCollateral.gt(0)){
                  //increase multiply
                  [debtDelta,collateralDelta] = calculateParamsIncreaseMP(
                        marketParams.oraclePrice,
                        marketParams.marketPrice,
                        marketParams.OF,
                        marketParams.FF,
                        vaultInfo.currentCollateral.plus(desiredCdp.providedCollateral),
                        vaultInfo.currentDebt.minus(desiredCdp.providedDai),
                        desiredCdp.requiredCollRatio,
                        marketParams.slippage,
                        desiredCdp.providedDai,
                  )
            }else{
                  let currentCollRat = vaultInfo.currentCollateral.times(marketParams.oraclePrice).dividedBy(vaultInfo.currentDebt);
                  if(currentCollRat.lt(desiredCdp.requiredCollRatio)){
                        //decrease mult
                        [debtDelta,collateralDelta] = calculateParamsDecreaseMP(
                              marketParams.oraclePrice,
                              marketParams.marketPrice,
                              marketParams.OF,
                              marketParams.FF,
                              vaultInfo.currentCollateral.minus(desiredCdp.withdrawColl),
                              vaultInfo.currentDebt.plus(desiredCdp.withdrawDai),
                              desiredCdp.requiredCollRatio,
                              marketParams.slippage,
                              desiredCdp.providedDai,
                        )
                        debtDelta = debtDelta.times(-1);
                        collateralDelta = collateralDelta.times(-1);
                  }else{
                        //increase mult
                        [debtDelta,collateralDelta] = calculateParamsIncreaseMP(
                              marketParams.oraclePrice,
                              marketParams.marketPrice,
                              marketParams.OF,
                              marketParams.FF,
                              vaultInfo.currentCollateral.plus(desiredCdp.providedCollateral),
                              vaultInfo.currentDebt.minus(desiredCdp.providedDai),
                              desiredCdp.requiredCollRatio,
                              marketParams.slippage,
                              desiredCdp.providedDai,
                        )
                  }
            }
        }

        return {
              debtDelta:ensureBigNumber(debtDelta),
              collateralDelta:ensureBigNumber(collateralDelta),
              loanFee:ensureBigNumber(loanFee),
              oazoFee:ensureBigNumber(oazoFee)
        }
  }

export { getMultiplyParams,  DesiredCDPState, MarketParams, VaultInfo}